#!/bin/bash

# Script to extract main content from SingleFile HTML archives
# and create simplified, reorganized versions in gushi2 directory

INPUT_DIR="/home/zhaosl/github/WebStack-Hugo/gushi"
OUTPUT_DIR="/home/zhaosl/github/WebStack-Hugo/gushi2"

# Process each HTML file in the gushi directory
for file in "$INPUT_DIR"/*.html; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        output_file="$OUTPUT_DIR/$filename"
        
        echo "Processing $filename..."
        
        # Extract the main content by finding the content between key markers
        # For Zhihu articles, the main content is usually within Post-RichTextContainer or RichContent
        title=$(echo "$filename" | sed 's/.html$//' | sed 's/_/ /g')
        
        # Get file size for display
        size_bytes=$(stat -c%s "$file")
        if [ $size_bytes -gt 1048576 ]; then
            size_str="$(echo "scale=1; $size_bytes/1048576" | bc)MB"
        elif [ $size_bytes -gt 1024 ]; then
            size_str="$(echo "scale=1; $size_bytes/1024" | bc)KB"
        else
            size_str="${size_bytes}B"
        fi
        
        # Create a clean HTML page with extracted content
        {
            echo "<!DOCTYPE html>"
            echo "<html lang=\"zh-CN\">"
            echo "<head>"
            echo "    <meta charset=\"UTF-8\">"
            echo "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">"
            echo "    <title>$title</title>"
            echo "    <link rel=\"stylesheet\" href=\"../assets/css/bootstrap.min-4.3.1.css\">"
            echo "    <link rel=\"stylesheet\" href=\"../assets/css/style-3.03029.1.css\">"
            echo "    <link rel=\"stylesheet\" href=\"../assets/css/custom-style.css\">"
            echo "    <style>"
            echo "        body {"
            echo "            font-family: \"SF Pro Display\", \"Helvetica Neue\", \"Segoe UI\", Arial, sans-serif;"
            echo "            background: linear-gradient(135deg, #f5f7fa 0%, #e4edf5 100%);"
            echo "            color: #2d3748;"
            echo "            margin: 0;"
            echo "            padding: 20px;"
            echo "            min-height: 100vh;"
            echo "        }"
            echo "        "
            echo "        .container {"
            echo "            max-width: 1200px;"
            echo "            margin: 0 auto;"
            echo "            background: rgba(255, 255, 255, 0.85);"
            echo "            backdrop-filter: blur(10px);"
            echo "            border-radius: 16px;"
            echo "            padding: 30px;"
            echo "            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);"
            echo "            border: 1px solid rgba(255, 255, 255, 0.5);"
            echo "        }"
            echo "        "
            echo "        .header {"
            echo "            border-bottom: 1px solid #e2e8f0;"
            echo "            padding-bottom: 20px;"
            echo "            margin-bottom: 30px;"
            echo "        }"
            echo "        "
            echo "        .title {"
            echo "            font-size: 1.8rem;"
            echo "            font-weight: bold;"
            echo "            color: #2d3748;"
            echo "            margin-bottom: 10px;"
            echo "        }"
            echo "        "
            echo "        .info {"
            echo "            color: #718096;"
            echo "            font-size: 0.9rem;"
            echo "        }"
            echo "        "
            echo "        .content {"
            echo "            line-height: 1.8;"
            echo "        }"
            echo "        "
            echo "        .back-link {"
            echo "            display: inline-block;"
            echo "            margin-top: 30px;"
            echo "            padding: 10px 20px;"
            echo "            background: rgba(247, 251, 254, 0.7);"
            echo "            color: #3182ce;"
            echo "            text-decoration: none;"
            echo "            border-radius: 6px;"
            echo "            transition: all 0.3s ease;"
            echo "        }"
            echo "        "
            echo "        .back-link:hover {"
            echo "            background: rgba(247, 251, 254, 0.9);"
            echo "            text-decoration: none;"
            echo "        }"
            echo "        "
            echo "        /* Clean up the imported content */"
            echo "        .content img {"
            echo "            max-width: 100%;"
            echo "            height: auto;"
            echo "        }"
            echo "        "
            echo "        .content p {"
            echo "            margin-bottom: 1.2em;"
            echo "        }"
            echo "        "
            echo "        .content h1, .content h2, .content h3 {"
            echo "            margin-top: 1.5em;"
            echo "            margin-bottom: 1em;"
            echo "        }"
            echo "    </style>"
            echo "</head>"
            echo "<body>"
            echo "    <div class=\"container\">"
            echo "        <div class=\"header\">"
            echo "            <div class=\"title\">$title</div>"
            echo "            <div class=\"info\">文件大小: $size_str | 来源: 知乎专栏</div>"
            echo "        </div>"
            echo "        "
            echo "        <div class=\"content\">"
            
            # Extract content between key markers
            # First, try to extract content within Post-RichTextContainer
            sed -n '/<div class="Post-RichTextContainer">/,/<\/div>/p' "$file" | \
            sed -n '/<div class="Post-RichTextContainer">/,$p' | \
            sed '/<\/div>/,/.*[^[:space:]]/ {/^[[:space:]]*$/d;}' | \
            sed 's/<script[^>]*>.*<\/script>//g; s/<style[^>]*>.*<\/style>//g; s/<nav[^>]*>.*<\/nav>//g; s/<header[^>]*>.*<\/header>//g; s/<footer[^>]*>.*<\/footer>//g; s/<aside[^>]*>.*<\/aside>//g' | \
            sed '/^[[:space:]]*$/d' | \
            sed '/^$/N;/^\s*\n$/D' | \
            sed 's/&/&amp;/g; s/</&lt;/g; s/>/&gt;/g; s/"/&quot;/g; s/'"'"'/&#39;/g'
            
            echo "        </div>"
            echo "        "
            echo "        <a href=\"./index.html\" class=\"back-link\">← 返回古诗文集首页</a>"
            echo "    </div>"
            echo "</body>"
            echo "</html>"
        } > "$output_file"
        
        echo "  -> Created $output_file"
    fi
done

echo "Processing complete!"