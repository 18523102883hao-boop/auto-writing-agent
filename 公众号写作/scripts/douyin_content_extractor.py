#!/usr/bin/env python3
"""
抖音博主视频文案批量提取工具
保存到 Obsidian 知识库
支持：批量下载、语音转文字、错误处理、断点续传、飞书通知
"""

import os
import sys
import json
import time
import subprocess
import logging
import requests
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional
import re

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('douyin_extractor.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 配置
CONFIG = {
    "obsidian_vault": "/Users/Zhuanz/Library/Mobile Documents/com~apple~CloudDocs/我的知识库（基于obsidian）/抖音博主内容",
    "douyin_user_id": "momocccc2",
    "douyin_user_url": "https://www.douyin.com/user/MS4wLjABAAAAZ9V0p8V1x8x8x8x8x8x8x8x8x8x8x8",  # 需要替换为实际的
    "download_dir": "./downloads",
    "checkpoint_file": ".checkpoint.json",
    "feishu_webhook": os.getenv("FEISHU_WEBHOOK", ""),  # 从环境变量读取
    "batch_size": 5,  # 每批处理数量
    "retry_times": 3,  # 重试次数
    "whisper_model": "medium",  # whisper 模型大小: tiny/base/small/medium/large
}


class DouyinContentExtractor:
    """抖音内容提取器"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.checkpoint = self.load_checkpoint()
        self.processed_videos = set(self.checkpoint.get("processed", []))
        self.failed_videos = self.checkpoint.get("failed", [])
        self.stats = {
            "total": 0,
            "success": 0,
            "failed": 0,
            "skipped": 0
        }
        
    def load_checkpoint(self) -> Dict:
        """加载断点记录"""
        checkpoint_path = Path(self.config["checkpoint_file"])
        if checkpoint_path.exists():
            try:
                with open(checkpoint_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"加载断点文件失败: {e}")
        return {"processed": [], "failed": [], "last_run": None}
    
    def save_checkpoint(self):
        """保存断点记录"""
        checkpoint = {
            "processed": list(self.processed_videos),
            "failed": self.failed_videos,
            "last_run": datetime.now().isoformat(),
            "stats": self.stats
        }
        try:
            with open(self.config["checkpoint_file"], 'w', encoding='utf-8') as f:
                json.dump(checkpoint, f, ensure_ascii=False, indent=2)
            logger.info(f"✅ 断点已保存: {len(self.processed_videos)} 个视频已处理")
        except Exception as e:
            logger.error(f"保存断点失败: {e}")
    
    def send_feishu_notification(self, title: str, content: str):
        """发送飞书通知"""
        webhook = self.config.get("feishu_webhook")
        if not webhook:
            logger.warning("未配置飞书 webhook，跳过通知")
            return
        
        try:
            payload = {
                "msg_type": "post",
                "content": {
                    "post": {
                        "zh_cn": {
                            "title": title,
                            "content": [[{"tag": "text", "text": content}]]
                        }
                    }
                }
            }
            response = requests.post(webhook, json=payload, timeout=10)
            if response.status_code == 200:
                logger.info("✅ 飞书通知已发送")
            else:
                logger.error(f"飞书通知发送失败: {response.status_code}")
        except Exception as e:
            logger.error(f"发送飞书通知失败: {e}")
    
    def download_video(self, video_url: str, output_path: str) -> bool:
        """下载单个视频（带重试）"""
        for attempt in range(self.config["retry_times"]):
            try:
                logger.info(f"📥 下载视频 (尝试 {attempt + 1}/{self.config['retry_times']}): {video_url}")
                
                # 使用 yt-dlp 下载
                cmd = [
                    "yt-dlp",
                    "--no-warnings",
                    "--no-check-certificates",
                    "-o", output_path,
                    video_url
                ]
                
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=120
                )
                
                if result.returncode == 0 and Path(output_path).exists():
                    logger.info(f"✅ 下载成功: {output_path}")
                    return True
                else:
                    logger.error(f"下载失败: {result.stderr}")
                    
            except subprocess.TimeoutExpired:
                logger.error(f"下载超时: {video_url}")
            except Exception as e:
                logger.error(f"下载异常: {e}")
            
            if attempt < self.config["retry_times"] - 1:
                wait_time = 2 ** attempt  # 指数退避
                logger.info(f"⏳ 等待 {wait_time} 秒后重试...")
                time.sleep(wait_time)
        
        return False
    
    def extract_transcript(self, video_path: str) -> Optional[str]:
        """提取视频文案（带重试）"""
        for attempt in range(self.config["retry_times"]):
            try:
                logger.info(f"🎙️ 提取文案 (尝试 {attempt + 1}/{self.config['retry_times']}): {video_path}")
                
                # 使用 Whisper 提取
                cmd = [
                    "whisper",
                    video_path,
                    "--model", self.config["whisper_model"],
                    "--language", "zh",
                    "--output_format", "json",
                    "--output_dir", str(Path(video_path).parent),
                    "--verbose", "False"
                ]
                
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=300
                )
                
                if result.returncode == 0:
                    # 读取生成的 JSON
                    json_path = video_path.replace(".mp4", ".json")
                    if Path(json_path).exists():
                        with open(json_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        
                        # 合并所有文本
                        transcript = " ".join([segment["text"] for segment in data.get("segments", [])])
                        logger.info(f"✅ 文案提取成功: {len(transcript)} 字符")
                        return transcript
                else:
                    logger.error(f"Whisper 失败: {result.stderr}")
                    
            except subprocess.TimeoutExpired:
                logger.error(f"提取超时: {video_path}")
            except Exception as e:
                logger.error(f"提取异常: {e}")
            
            if attempt < self.config["retry_times"] - 1:
                wait_time = 2 ** attempt
                logger.info(f"⏳ 等待 {wait_time} 秒后重试...")
                time.sleep(wait_time)
        
        return None
    
    def save_to_obsidian(self, video_info: Dict, transcript: str) -> Optional[Path]:
        """保存到 Obsidian 知识库"""
        try:
            # 创建目录
            vault_path = Path(self.config["obsidian_vault"])
            user_path = vault_path / self.config["douyin_user_id"]
            user_path.mkdir(parents=True, exist_ok=True)
            
            # 生成文件名
            date = video_info.get("date", datetime.now().strftime("%Y-%m-%d"))
            title = video_info.get("title", "untitled")[:30]
            video_id = video_info.get("id", "unknown")
            filename = f"{date}-{video_id}-{title}.md"
            filepath = user_path / filename
            
            # 清理文件名
            filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
            filepath = user_path / filename
            
            # 生成 Markdown 内容
            content = f"""# {video_info.get('title', '无标题')}

## 元数据
- **博主**: {self.config["douyin_user_id"]}
- **视频ID**: {video_id}
- **日期**: {date}
- **视频链接**: {video_info.get('url', '')}
- **本地视频**: {video_info.get('local_path', '')}
- **处理时间**: {datetime.now().isoformat()}

## 文案内容

{transcript}

## 标签
#抖音 #{self.config["douyin_user_id"]} #短视频 #{video_info.get('tag', '')}

---
*自动提取于 {datetime.now().strftime("%Y-%m-%d %H:%M")}*
"""
            
            filepath.write_text(content, encoding="utf-8")
            logger.info(f"✅ 已保存到 Obsidian: {filepath}")
            return filepath
            
        except Exception as e:
            logger.error(f"保存到 Obsidian 失败: {e}")
            return None
    
    def process_video(self, video_info: Dict) -> bool:
        """处理单个视频"""
        video_id = video_info.get("id")
        
        # 检查是否已处理
        if video_id in self.processed_videos:
            logger.info(f"⏭️ 跳过已处理视频: {video_id}")
            self.stats["skipped"] += 1
            return True
        
        try:
            # 1. 下载视频
            video_url = video_info.get("url")
            local_path = os.path.join(self.config["download_dir"], f"{video_id}.mp4")
            
            if not self.download_video(video_url, local_path):
                self.failed_videos.append(video_id)
                self.stats["failed"] += 1
                return False
            
            video_info["local_path"] = local_path
            
            # 2. 提取文案
            transcript = self.extract_transcript(local_path)
            if not transcript:
                self.failed_videos.append(video_id)
                self.stats["failed"] += 1
                return False
            
            # 3. 保存到 Obsidian
            saved_path = self.save_to_obsidian(video_info, transcript)
            if not saved_path:
                self.failed_videos.append(video_id)
                self.stats["failed"] += 1
                return False
            
            # 4. 标记为已处理
            self.processed_videos.add(video_id)
            self.stats["success"] += 1
            
            # 5. 发送飞书通知
            self.send_feishu_notification(
                f"✅ 视频处理完成: {self.config['douyin_user_id']}",
                f"视频ID: {video_id}\n标题: {video_info.get('title', '无标题')}\n文案长度: {len(transcript)} 字符\n保存位置: {saved_path}"
            )
            
            return True
            
        except Exception as e:
            logger.error(f"处理视频异常: {e}")
            self.failed_videos.append(video_id)
            self.stats["failed"] += 1
            return False
    
    def get_video_list(self) -> List[Dict]:
        """获取视频列表（需要实现）"""
        # TODO: 实现从抖音获取视频列表
        # 可以使用 amemv-crawler 或 yt-dlp
        logger.info("📋 获取视频列表...")
        
        # 示例：返回测试数据
        # 实际实现需要调用抖音 API 或爬虫
        return []
    
    def run(self):
        """主运行流程"""
        logger.info("=" * 50)
        logger.info(f"🚀 开始提取抖音博主内容: {self.config['douyin_user_id']}")
        logger.info("=" * 50)
        
        # 1. 获取视频列表
        videos = self.get_video_list()
        self.stats["total"] = len(videos)
        
        logger.info(f"📊 共找到 {len(videos)} 个视频，已处理 {len(self.processed_videos)} 个")
        
        # 2. 批量处理
        for i, video in enumerate(videos, 1):
            logger.info(f"\n{'='*50}")
            logger.info(f"🎬 处理视频 {i}/{len(videos)}: {video.get('id')}")
            logger.info(f"{'='*50}")
            
            success = self.process_video(video)
            
            # 每处理完一个保存断点
            self.save_checkpoint()
            
            # 显示进度
            progress = (i / len(videos)) * 100
            logger.info(f"📈 进度: {progress:.1f}% ({i}/{len(videos)})")
            logger.info(f"📊 统计: 成功 {self.stats['success']} | 失败 {self.stats['failed']} | 跳过 {self.stats['skipped']}")
            
            # 每批处理完休息一下
            if i % self.config["batch_size"] == 0:
                logger.info(f"⏳ 批次完成，休息 5 秒...")
                time.sleep(5)
        
        # 3. 完成总结
        logger.info("\n" + "=" * 50)
        logger.info("✅ 处理完成!")
        logger.info("=" * 50)
        logger.info(f"总计: {self.stats['total']} 个视频")
        logger.info(f"成功: {self.stats['success']} 个")
        logger.info(f"失败: {self.stats['failed']} 个")
        logger.info(f"跳过: {self.stats['skipped']} 个")
        
        # 发送完成通知
        self.send_feishu_notification(
            f"🎉 抖音内容提取完成: {self.config['douyin_user_id']}",
            f"总计: {self.stats['total']} 个视频\n成功: {self.stats['success']} 个\n失败: {self.stats['failed']} 个\n跳过: {self.stats['skipped']} 个\n\n保存位置: {self.config['obsidian_vault']}"
        )
        
        # 保存最终断点
        self.save_checkpoint()


def main():
    """主入口"""
    extractor = DouyinContentExtractor(CONFIG)
    extractor.run()


if __name__ == "__main__":
    main()