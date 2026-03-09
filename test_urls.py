#!/usr/bin/env python3
import json
import concurrent.futures
from urllib.parse import urlparse
import urllib.request
import urllib.error
import time
import ssl

def test_url(url_data):
    """测试单个URL的可用性"""
    title = url_data.get('title', 'Unknown')
    url = url_data.get('url', '')
    category = url_data.get('category', 'Unknown')

    # 跳过非HTTP链接
    if not url.startswith(('http://', 'https://')):
        return {
            'title': title,
            'url': url,
            'category': category,
            'status': 'skipped',
            'reason': 'Not an HTTP/HTTPS URL'
        }

    try:
        # 设置超时和重试
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        req = urllib.request.Request(url, headers=headers)

        # 创建SSL上下文（忽略证书验证，避免某些网站的SSL问题）
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

        start_time = time.time()
        with urllib.request.urlopen(req, timeout=10, context=ssl_context) as response:
            response_time = time.time() - start_time
            status_code = response.getcode()

            # 检查状态码
            if status_code >= 200 and status_code < 400:
                return {
                    'title': title,
                    'url': url,
                    'category': category,
                    'status': 'success',
                    'status_code': status_code,
                    'response_time': round(response_time, 2)
                }
            else:
                return {
                    'title': title,
                    'url': url,
                    'category': category,
                    'status': 'failed',
                    'status_code': status_code,
                    'reason': f'HTTP {status_code}'
                }

    except urllib.error.HTTPError as e:
        return {
            'title': title,
            'url': url,
            'category': category,
            'status': 'failed',
            'status_code': e.code,
            'reason': f'HTTP {e.code}'
        }
    except urllib.error.URLError as e:
        if isinstance(e.reason, TimeoutError):
            return {
                'title': title,
                'url': url,
                'category': category,
                'status': 'failed',
                'reason': 'Timeout'
            }
        else:
            return {
                'title': title,
                'url': url,
                'category': category,
                'status': 'failed',
                'reason': f'Connection Error: {str(e.reason)}'
            }
    except Exception as e:
        return {
            'title': title,
            'url': url,
            'category': category,
            'status': 'failed',
            'reason': str(e)
        }

def extract_urls_from_nav(nav_data):
    """从导航数据中提取所有URL"""
    urls = []

    def process_items(items, category):
        for item in items:
            if 'url' in item:
                urls.append({
                    'title': item.get('title', ''),
                    'url': item.get('url', ''),
                    'category': category
                })

    for category_data in nav_data.get('navigation', []):
        category = category_data.get('category', 'Unknown')

        # 处理直接items
        if 'items' in category_data:
            process_items(category_data['items'], category)

        # 处理子分类
        if 'subcategories' in category_data:
            for subcategory in category_data['subcategories']:
                subcategory_name = subcategory.get('name', '')
                full_category = f"{category} > {subcategory_name}" if subcategory_name else category
                if 'items' in subcategory:
                    process_items(subcategory['items'], full_category)

    return urls

def main():
    # 读取nav.json文件
    try:
        with open('nav.json', 'r', encoding='utf-8') as f:
            nav_data = json.load(f)
    except Exception as e:
        print(f"无法读取nav.json文件: {e}")
        return

    # 提取所有URL
    urls_to_test = extract_urls_from_nav(nav_data)
    print(f"找到 {len(urls_to_test)} 个URL需要测试\n")

    # 使用线程池并发测试URL
    failed_urls = []
    success_count = 0
    failed_count = 0
    skipped_count = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        # 提交所有任务
        future_to_url = {executor.submit(test_url, url_data): url_data for url_data in urls_to_test}

        # 处理结果
        for future in concurrent.futures.as_completed(future_to_url):
            result = future.result()

            if result['status'] == 'success':
                success_count += 1
                print(f"✓ {result['title']}: {result['url']} ({result['response_time']}s)")
            elif result['status'] == 'failed':
                failed_count += 1
                failed_urls.append(result)
                print(f"✗ {result['title']}: {result['url']} - {result['reason']}")
            elif result['status'] == 'skipped':
                skipped_count += 1
                print(f"⊘ {result['title']}: {result['url']} - {result['reason']}")

    # 输出统计信息
    print(f"\n{'='*60}")
    print(f"测试完成！")
    print(f"总计: {len(urls_to_test)} 个URL")
    print(f"成功: {success_count} 个")
    print(f"失败: {failed_count} 个")
    print(f"跳过: {skipped_count} 个")
    print(f"{'='*60}\n")

    # 输出失败的URL详情
    if failed_urls:
        print("失败的URL列表:")
        print(f"{'='*60}")
        for i, url in enumerate(failed_urls, 1):
            print(f"\n{i}. {url['title']}")
            print(f"   分类: {url['category']}")
            print(f"   URL: {url['url']}")
            print(f"   原因: {url['reason']}")
            if 'status_code' in url:
                print(f"   状态码: {url['status_code']}")

        # 保存失败列表到文件
        with open('failed_urls.json', 'w', encoding='utf-8') as f:
            json.dump(failed_urls, f, ensure_ascii=False, indent=2)
        print(f"\n失败列表已保存到 failed_urls.json")

if __name__ == '__main__':
    main()
