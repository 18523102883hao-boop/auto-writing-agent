#!/usr/bin/env python3
"""
Knowledge Ingest - 自动将文章、视频等内容收录到 Knowledge 知识库

使用方法:
    python3 ingest.py <URL> [--output-dir <目录>]

支持的来源:
    - B站视频: b23.tv, bilibili.com, BV号
    - 微信公众号: mp.weixin.qq.com
    - 飞书文档: feishu.cn/wiki, feishu.cn/docx
    - 网页文章: http://, https://

示例:
    python3 ingest.py "https://b23.tv/de6SZul"
    python3 ingest.py "https://mp.weixin.qq.com/s/xxxxx"
    python3 ingest.py "https://mcndg9yue1j0.feishu.cn/wiki/xxx"
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

# 配置
SKILLS_BASE = Path(__file__).resolve().parents[2]
DEFAULT_KNOWLEDGE_BASES = [
    os.environ.get("OPENCLAW_KNOWLEDGE_BASE", ""),
    "/Users/Zhuanz/Library/Mobile Documents/com~apple~CloudDocs/AI日报开发dify/knowledge",
    "/Users/Zhuanz/Library/Mobile Documents/com~apple~CloudDocs/我的知识库（基于obsidian）/knowledge",
    "/Users/Zhuanz/Library/Mobile Documents/com~apple~CloudDocs/我的知识库（基于obsidian）",
]


def resolve_default_knowledge_base() -> str:
    """选择当前可用的知识库根目录。"""
    for candidate in DEFAULT_KNOWLEDGE_BASES:
        if not candidate:
            continue
        path = Path(candidate).expanduser()
        if path.exists():
            return str(path)
    return DEFAULT_KNOWLEDGE_BASES[1]


DEFAULT_KNOWLEDGE_BASE = resolve_default_knowledge_base()


def detect_source_type(url: str) -> str:
    """识别 URL 来源类型"""
    url_lower = url.lower()
    
    if any(domain in url_lower for domain in ["b23.tv", "bilibili.com"]):
        return "bilibili"
    elif "mp.weixin.qq.com" in url_lower:
        return "wechat"
    elif "feishu.cn" in url_lower:
        return "feishu"
    elif url_lower.startswith(("http://", "https://")):
        return "web"
    else:
        return "unknown"


def process_bilibili(url: str, output_dir: str) -> dict:
    """处理 B站视频"""
    print(f"🎬 识别为 B站视频: {url}")
    
    # 调用 bilibili-transcriber
    bili_script = SKILLS_BASE / "bilibili-transcriber" / "bili-transcribe.py"
    
    if not bili_script.exists():
        return {"success": False, "error": f"找不到脚本: {bili_script}"}
    
    # 创建临时输出目录
    temp_output = Path(output_dir) / "temp" / f"bili_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    temp_output.mkdir(parents=True, exist_ok=True)
    
    try:
        # 执行转录
        result = subprocess.run(
            ["python3", str(bili_script), url, "--model", "base"],
            capture_output=True,
            text=True,
            cwd=str(temp_output),
            timeout=600  # 10分钟超时
        )
        
        if result.returncode != 0:
            return {"success": False, "error": f"转录失败: {result.stderr}"}
        
        # 查找生成的转录文件
        txt_files = list(temp_output.glob("*.txt"))
        if not txt_files:
            return {"success": False, "error": "未找到转录输出文件"}
        
        transcript_file = txt_files[0]
        transcript_content = transcript_file.read_text(encoding="utf-8")
        
        # 提取视频标题（从文件名或内容）
        title = transcript_file.stem.replace("_transcript", "").replace("_", " ")
        
        return {
            "success": True,
            "title": title,
            "content": transcript_content,
            "word_count": len(transcript_content),
            "source_file": str(transcript_file)
        }
        
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "转录超时（超过10分钟）"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def process_wechat(url: str, output_dir: str) -> dict:
    """处理微信公众号文章"""
    print(f"📄 识别为微信公众号文章: {url}")
    
    # 调用 wechat-article-to-md
    wechat_script = SKILLS_BASE / "wechat-article-to-md" / "scripts" / "wechat_article_to_md.py"
    
    if not wechat_script.exists():
        return {"success": False, "error": f"找不到脚本: {wechat_script}"}
    
    # 创建临时输出目录
    temp_output = Path(output_dir) / "temp" / f"wechat_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    temp_output.mkdir(parents=True, exist_ok=True)
    
    try:
        # 执行抓取
        result = subprocess.run(
            ["python3", str(wechat_script), url, "--output", str(temp_output)],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode != 0:
            return {"success": False, "error": f"抓取失败: {result.stderr}"}
        
        # 查找生成的 markdown 文件
        md_files = list(temp_output.glob("*.md"))
        if not md_files:
            return {"success": False, "error": "未找到 Markdown 输出文件"}
        
        md_file = md_files[0]
        content = md_file.read_text(encoding="utf-8")
        
        # 提取标题（从 frontmatter 或文件名）
        title = md_file.stem
        # 尝试从内容中提取标题
        lines = content.split("\n")
        for line in lines:
            if line.startswith("# "):
                title = line[2:].strip()
                break
        
        return {
            "success": True,
            "title": title,
            "content": content,
            "word_count": len(content),
            "source_file": str(md_file)
        }
        
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "抓取超时"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def process_feishu(url: str, output_dir: str) -> dict:
    """处理飞书文档"""
    print(f"📚 识别为飞书文档: {url}")
    
    # 飞书文档需要使用 feishu_doc tool，这里返回提示信息
    return {
        "success": False,
        "error": "飞书文档需要通过 OpenClaw feishu_doc tool 处理，请使用 /feishu_doc 命令",
        "manual_action_required": True
    }


def process_web(url: str, output_dir: str) -> dict:
    """处理网页文章"""
    print(f"🌐 识别为网页文章: {url}")
    
    # 使用 web_fetch 工具（通过 curl 模拟）
    try:
        result = subprocess.run(
            ["curl", "-s", "-L", url],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            return {"success": False, "error": f"抓取失败: {result.stderr}"}
        
        html_content = result.stdout
        
        # 简单提取文本（去除 HTML 标签）
        # 使用 lynx 或 w3m 如果可用，否则使用简单正则
        text_content = re.sub(r'<[^>]+>', '', html_content)
        text_content = re.sub(r'\s+', ' ', text_content).strip()
        
        # 提取标题
        title_match = re.search(r'<title[^>]*>([^<]+)</title>', html_content, re.IGNORECASE)
        title = title_match.group(1).strip() if title_match else "网页文章"
        
        return {
            "success": True,
            "title": title,
            "content": text_content,
            "word_count": len(text_content)
        }
        
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "抓取超时"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def generate_knowledge_entry(data: dict, url: str, source_type: str) -> str:
    """生成知识条目 Markdown"""
    
    today = datetime.now().strftime("%Y-%m-%d")
    title = data.get("title", "未命名")
    content = data.get("content", "")
    word_count = data.get("word_count", 0)
    
    # 生成文件名（清理特殊字符）
    safe_title = re.sub(r'[^\w\s-]', '', title).strip()[:50]
    filename = f"{today}-{safe_title}.md"
    
    # 提取标签（简单实现：从内容中提取关键词）
    tags = extract_tags(content)
    
    # 生成 AI 摘要（取前3-5句）
    summary = generate_summary(content)
    
    # 构建 frontmatter
    entry = f"""---
date: {today}
source: {source_type}
source_type: {source_type}
source_url: "{url}"
tags:
{chr(10).join(f'  - {tag}' for tag in tags)}
word_count: {word_count}
confidence: processed
---

# {title}

## 核心观点
{summary}

## 我的思考
[待补充]

## 原始内容
{content}
"""
    
    return entry, filename


def extract_tags(content: str) -> list:
    """从内容中提取标签（简单实现）"""
    # 这里可以接入更复杂的 NLP 标签提取
    # 目前使用简单关键词匹配
    common_tags = {
        "AI": ["人工智能", "AI", "机器学习", "深度学习"],
        "编程": ["代码", "编程", "开发", "程序员"],
        "产品": ["产品", "设计", "用户体验", "UI", "UX"],
        "运营": ["运营", "营销", "增长", "抖音", "小红书"],
        "管理": ["管理", "团队", "领导力", "效率"],
        "技术": ["技术", "架构", "系统", "数据库"],
    }
    
    tags = []
    for tag, keywords in common_tags.items():
        if any(kw in content for kw in keywords):
            tags.append(tag)
    
    return tags[:5] if tags else ["未分类"]


def generate_summary(content: str) -> str:
    """生成内容摘要（取前3-5句）"""
    # 简单实现：按句子分割，取前几句
    sentences = re.split(r'[。！？.!?]', content)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
    
    summary_sentences = sentences[:5]
    return "\n".join(f"- {s}" for s in summary_sentences) if summary_sentences else "- [内容暂无摘要]"


def update_index(knowledge_base: str, filename: str, title: str, source_type: str):
    """更新 _index.md 索引"""
    index_file = Path(knowledge_base) / "_index.md"
    
    today = datetime.now().strftime("%Y-%m-%d")
    entry_line = f"- [{today}] [{source_type}] [{title}](./{filename})"
    
    if index_file.exists():
        content = index_file.read_text(encoding="utf-8")
        # 在 ## 最新入库 部分添加
        if "## 最新入库" in content:
            content = content.replace(
                "## 最新入库",
                f"## 最新入库\n\n{entry_line}"
            )
        else:
            content += f"\n\n## 最新入库\n\n{entry_line}"
    else:
        content = f"""# Knowledge 索引

## 最新入库

{entry_line}

## 分类索引

### 按来源
- [文章](./articles/)
- [视频](./videos/)
- [文档](./docs/)

### 按标签
[自动生成]
"""
    
    index_file.write_text(content, encoding="utf-8")
    print(f"📝 已更新索引: {index_file}")


def main():
    parser = argparse.ArgumentParser(description="Knowledge Ingest - 自动收录内容到知识库")
    parser.add_argument("url", help="要收录的 URL")
    parser.add_argument("--output-dir", "-o", default=DEFAULT_KNOWLEDGE_BASE,
                       help=f"知识库目录 (默认: {DEFAULT_KNOWLEDGE_BASE})")
    parser.add_argument("--dry-run", "-d", action="store_true",
                       help="试运行，不实际保存文件")
    
    args = parser.parse_args()
    
    # 确保知识库目录存在
    knowledge_base = Path(args.output_dir)
    knowledge_base.mkdir(parents=True, exist_ok=True)
    
    # 识别来源类型
    source_type = detect_source_type(args.url)
    print(f"🔍 识别来源类型: {source_type}")
    
    if source_type == "unknown":
        print(f"❌ 无法识别 URL 类型: {args.url}")
        sys.exit(1)
    
    # 根据类型处理
    processors = {
        "bilibili": process_bilibili,
        "wechat": process_wechat,
        "feishu": process_feishu,
        "web": process_web,
    }
    
    processor = processors.get(source_type)
    if not processor:
        print(f"❌ 不支持的来源类型: {source_type}")
        sys.exit(1)
    
    # 执行处理
    result = processor(args.url, str(knowledge_base))
    
    if not result["success"]:
        print(f"❌ 处理失败: {result.get('error', '未知错误')}")
        if result.get("manual_action_required"):
            print("💡 提示: 此来源需要手动处理")
        sys.exit(1)
    
    # 生成知识条目
    entry_content, filename = generate_knowledge_entry(result, args.url, source_type)
    
    if args.dry_run:
        print(f"\n--- 试运行模式，以下内容将保存到 {filename} ---")
        print(entry_content[:500] + "...")
        sys.exit(0)
    
    # 保存文件
    output_file = knowledge_base / filename
    output_file.write_text(entry_content, encoding="utf-8")
    print(f"✅ 已保存: {output_file}")
    
    # 更新索引
    update_index(str(knowledge_base), filename, result["title"], source_type)
    
    # 输出结果
    print(f"\n📊 处理结果:")
    print(f"   标题: {result['title']}")
    print(f"   字数: {result['word_count']}")
    print(f"   文件: {filename}")
    print(f"   来源: {source_type}")


if __name__ == "__main__":
    main()
