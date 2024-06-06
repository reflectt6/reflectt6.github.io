#!/bin/zsh

# 指定要遍历的目录
#directory="_posts"

# 使用 find 命令递归遍历目录下的所有文件
#find "$directory" -type f | while read -r file
#do
#    echo "处理文件：$file"
    # 在这里可以添加对文件的处理操作
    #sed -i -E "s/(\[[^][]*\]\(http[^()]*\))/$\1{:target=\"_blank\"}/g" "$file"
#    sed -E "s/(\[[^][]*\]\(http[^()]*\))/$\1{:target=\"_blank\"}/g" "$file"
#done

grep -nr -E '\[[^][]*\]\(http[^()]*\)[^\{:target="_blank"\}]' _posts| awk -F ':' '{print $1}' | uniq | while IFS= read -r line; do
    file=${line}
    # 提取文件名和匹配内容
    #file=$(echo "$line" | cut -d':' -f1)
    #num=$(echo "$line" | cut -d':' -f2)
    #match=$(echo "$line" | cut -d':' -f3-)

    # 使用sed进行替换，在匹配内容后面添加{:target="_blank"}
    sed -i '' -E "s/(\[[^][]*\]\(http[^()]*\))/\1{:target=\"_blank\"}/g" "$file"
    #sed -E "s/(\[[^][]*\]\(http[^()]*\))/\1{:target=\"_blank\"}/g" "$file"
done
#done < matches.txt
