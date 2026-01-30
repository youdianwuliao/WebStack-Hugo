#!/usr/bin/env python3
"""
Script to extract main content from SingleFile HTML archives in gushi directory
and create a clean, reorganized version in gushi2 directory.
"""

import os
import re
from bs4 import BeautifulSoup

def extract_main_content(html_file_path):
    """Extract main content from a SingleFile HTML archive."""
    try:
        with open(html_file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        soup = BeautifulSoup(content, 'html.parser')
        
        # Try to find main content areas
        # Look for common article/content containers
        main_content = None
        
        # Try different selectors commonly used by websites
        selectors_to_try = [
            'article',
            '.RichContent',  # Zhihu
            '.Post-RichTextContainer',
            '.Article-content',
            '.entry-content',
            '.post-content',
            '.content',
            '.main-content',
            '#content',
            '#article',
            '[data-role="article-content"]',
            '.zhuanlan-post-content',
            '.RichText',
            '.Post-Title'
        ]
        
        for selector in selectors_to_try:
            elements = soup.select(selector)
            if elements:
                # Join all matching elements
                content_parts = []
                for elem in elements:
                    content_parts.append(str(elem))
                main_content = ''.join(content_parts)
                break
        
        # If we couldn't find content with selectors, try to extract readable text
        if not main_content:
            # Remove script and style elements
            for script in soup(["script", "style", "nav", "header", "footer", "aside"]):
                script.decompose()
            
            # Try to get the largest text block
            paragraphs = soup.find_all(['p', 'div', 'section', 'article'])
            max_len = 0
            main_content = ""
            
            for p in paragraphs:
                text = str(p)
                if len(text) > max_len and len(p.get_text().strip()) > 50:
                    max_len = len(text)
                    main_content = text
        
        # If still no content found, get body content
        if not main_content:
            body = soup.find('body')
            if body:
                main_content = str(body)
        
        return main_content if main_content else content[:5000]  # Fallback to first 5000 chars
        
    except Exception as e:
        print(f"Error processing {html_file_path}: {str(e)}")
        return f"<!-- Error processing file: {str(e)} -->"


def create_clean_html(original_title, main_content, original_file_path):
    """Create a clean HTML page with extracted content."""
    # Generate title from filename if needed
    title = original_title.replace('.html', '').replace('_', ' ')
    
    # Get file size for display
    file_size = os.path.getsize(original_file_path)
    size_str = f"{file_size / 1024:.1f}KB" if file_size < 1024 * 1024 else f"{file_size / (1024*1024):.1f}MB"
    
    clean_html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link rel="stylesheet" href="../assets/css/bootstrap.min-4.3.1.css">
    <link rel="stylesheet" href="../assets/css/style-3.03029.1.css">
    <link rel="stylesheet" href="../assets/css/custom-style.css">
    <style>
        body {{
            font-family: "SF Pro Display", "Helvetica Neue", "Segoe UI", Arial, sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #e4edf5 100%);
            color: #2d3748;
            margin: 0;
            padding: 20px;
            min-height: 100vh;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.5);
        }}
        
        .header {{
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        
        .title {{
            font-size: 1.8rem;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 10px;
        }}
        
        .info {{
            color: #718096;
            font-size: 0.9rem;
        }}
        
        .content {{
            line-height: 1.8;
        }}
        
        .back-link {{
            display: inline-block;
            margin-top: 30px;
            padding: 10px 20px;
            background: rgba(247, 251, 254, 0.7);
            color: #3182ce;
            text-decoration: none;
            border-radius: 6px;
            transition: all 0.3s ease;
        }}
        
        .back-link:hover {{
            background: rgba(247, 251, 254, 0.9);
            text-decoration: none;
        }}
        
        /* Clean up the imported content */
        .content img {{
            max-width: 100%;
            height: auto;
        }}
        
        .content p {{
            margin-bottom: 1.2em;
        }}
        
        .content h1, .content h2, .content h3 {{
            margin-top: 1.5em;
            margin-bottom: 1em;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">{title}</div>
            <div class="info">文件大小: {size_str} | 来源: 知乎专栏</div>
        </div>
        
        <div class="content">
            {main_content}
        </div>
        
        <a href="./index.html" class="back-link">← 返回古诗文集首页</a>
    </div>
</body>
</html>"""
    
    return clean_html


def process_gushi_directory():
    """Process all HTML files in gushi directory and create clean versions in gushi2."""
    gushi_dir = '/home/zhaosl/github/WebStack-Hugo/gushi/'
    gushi2_dir = '/home/zhaosl/github/WebStack-Hugo/gushi2/'
    
    # Get all HTML files in gushi directory
    html_files = [f for f in os.listdir(gushi_dir) if f.endswith('.html')]
    
    for filename in html_files:
        input_path = os.path.join(gushi_dir, filename)
        output_path = os.path.join(gushi2_dir, filename)
        
        print(f"Processing {filename}...")
        
        # Extract main content
        main_content = extract_main_content(input_path)
        
        # Create clean HTML page
        clean_page = create_clean_html(filename, main_content, input_path)
        
        # Write to gushi2 directory
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(clean_page)
        
        print(f"  -> Created {output_path}")


if __name__ == "__main__":
    # Check if BeautifulSoup is available
    try:
        import bs4
        process_gushi_directory()
    except ImportError:
        print("BeautifulSoup4 is not installed. Installing...")
        os.system("pip install beautifulsoup4 lxml")
        import bs4
        process_gushi_directory()