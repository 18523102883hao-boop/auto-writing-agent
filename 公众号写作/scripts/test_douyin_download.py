#!/usr/bin/env python3
"""
测试抖音视频下载
"""

import subprocess
import os
import sys

# 添加 yt-dlp 到 PATH
os.environ["PATH"] = os.environ.get("PATH", "") + ":/Users/Zhuanz/Library/Python/3.9/bin"

def test_yt_dlp():
    """测试 yt-dlp 是否可用"""
    try:
        result = subprocess.run(
            ["yt-dlp", "--version"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode == 0:
            print(f"✅ yt-dlp 版本: {result.stdout.strip()}")
            return True
        else:
            print(f"❌ yt-dlp 错误: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ yt-dlp 未找到: {e}")
        return False

def test_download():
    """测试下载抖音视频"""
    # 注意：这里需要一个实际的抖音视频链接
    # 由于抖音的反爬机制，直接下载可能需要 cookies 或其他验证
    
    test_url = "https://www.douyin.com/video/1234567890"  # 示例链接
    
    print(f"📥 测试下载: {test_url}")
    
    try:
        result = subprocess.run(
            [
                "yt-dlp",
                "--no-warnings",
                "--no-check-certificates",
                "--list-formats",  # 只列出格式，不下载
                test_url
            ],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        print(f"返回码: {result.returncode}")
        print(f"输出:\n{result.stdout}")
        print(f"错误:\n{result.stderr}")
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")

if __name__ == "__main__":
    print("=" * 50)
    print("测试抖音视频下载工具")
    print("=" * 50)
    
    if test_yt_dlp():
        print("\n✅ yt-dlp 已安装")
        test_download()
    else:
        print("\n❌ 请先安装 yt-dlp")
        print("安装命令: python3 -m pip install yt-dlp --user")
        sys.exit(1)
