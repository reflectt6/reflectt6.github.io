/*
 * Copyright (c) 2023 reflectt6
 */

// 读取feed.xml
var blogs = []
var titles = []
var links = []
var contents = []
var mainTag = []
var secondaryTag = []
$.get("/feed.xml", function (data) {
    blogs = $(data).find("item")
    for (let i = 0; i < blogs.length; i++) {
        titles.push(washTag($(blogs[i]).find("title").text()))
        links.push(washTag($(blogs[i]).find("link").text()))
        var content = $(blogs[i]).find("content").text()
        var cleanContent = washContent(content)
        contents.push(cleanContent)
        mainTag.push(washTag($(blogs[i]).find("mainTag").text()))
        secondaryTag.push(washTag($(blogs[i]).find("secondaryTag").text()))
    }
})

function washContent(text) {
    // 非贪婪模式匹配
    return text.replaceAll(/<.*?>/g, "").replaceAll("\n", " ")
}

function washTag(text) {
    // 非贪婪模式匹配
    return text.replaceAll(/<.*?>/g, "").replaceAll("\n", " ").replaceAll(" ", "")
}

function open_search_bar() {
    var $sb = $("#search-background1")
    if ($sb.length === 0) {
        return
    }
    $sb.css("display", "flex")
    var $si = $('#search-input')
    var $body = $("body")
    if (!$body.data("esc_search_bar_shortcut")) {
        $si.on('input', function () {
            start_search()
        })
        // ESC退出搜索
        $sb.on("keyup", function (e) {
            if (e.keyCode === 27) {
                close_search_bar()

            }
        });
        $body.data("esc_search_bar_shortcut", true)
    }
    $sb.on("click", other_method_close_search_bar)
    $si.focus()
}

function close_search_bar() {
    var $sb = $("#search-background1")
    if ($sb.length === 0) {
        return
    }
    $sb.css("display", "none")
    $sb.off("click")
}

function other_method_close_search_bar(event) {
    var $ss = $("#search-section")
    if (!$ss.is(event.target) && $ss.has(event.target).length === 0) {
        close_search_bar()
    }
}


$(document).ready(function () {
    // 不知道为啥文档就绪事件会触发两次，通过data标志位，判断事件是否已经被监听，防止多次监听事件带来的方法多次执行问题
    // https://blog.51cto.com/u_16175504/7284150
    var $body = $("body")
    if(!$body.data("search-shortcut")) {
        $body.on("keydown", function (e) {
            // ctrl + k 打开搜索
            if (e.ctrlKey && e.which === 75) {
                open_search_bar()
                e.preventDefault()
            }
        })
        $body.data("search-shortcut", true)
    }
})


function mouse_in(event) {
    if (this === event.target || $(this).has(event.target).length > 0) {
        $(this).css("background", "#202425")
    }
}

function mouse_out(event) {
    if (this === event.target || $(this).has(event.target).length > 0) {
        $(this).css("background", "transparent")
    }
}


function start_search() {
    var $si = $('#search-input')
    if ($si.length === 0) {
        return
    }
    if ($si.val() === '' || $si.val().search(/^\s+$/) >= 0) {
        // 输入空白的情况,提示暂无结果
        var $sr = $('#search-results')
        $sr.empty()
        $sr.append($("<div id=\"empty-result\">暂无结果</div>"));
    } else {
        // 在标题、内容中查找
        jquery_search_action(titles, contents, $('#search-input').val());
    }
}

function jquery_search_action(titles, contents, input) {
    var matchedCount = 0
    // 忽略输入大小写
    inputReg = new RegExp(input, 'i');
    // 在所有文章标题、内容中匹配查询值
    for (i = 0; i < blogs.length; i++) {

        title_index = titles[i].search(inputReg)
        content_index = contents[i].search(inputReg)
        if (title_index === -1 && content_index === -1) {
            continue
        }

        matchedCount++

        var rd = $('<div class="result-d">')
        var rpt = $('<p class="result-p-title">')
        var rst = $('<span class="result-span-title">')
        if (title_index !== -1) {
            rst.html(get_title_text(titles[i], title_index, input.length))
        } else {
            rst.text(titles[i])
        }
        rpt.append(rst)
        if (mainTag[i] !== "") {
            var rsTag = $('<span class="result-span-tag">')
            rsTag.text(mainTag[i])
            rpt.append(rsTag)
        }
        if (secondaryTag[i] !== "") {
            var rsTag2 = $('<span class="result-span-tag">')
            rsTag2.text(secondaryTag[i])
            rpt.append(rsTag2)
        }
        rd.append(rpt)
        var result_excerpt = $("<p class='result-excerpt'></p>")
        if (content_index !== -1) {
            result_excerpt.html(get_result_excerpt(contents[i], content_index, input.length))
        } else {
            result_excerpt.text(get_resultExcerpt_withoutMark(contents[i]))
        }
        rd.append(result_excerpt)
        var result_item = $('<a href="' + links[i] + '" class="result-a">')
        result_item.append(rd)
        if (matchedCount === 1) {
            // 找到第一个结果, 则清空结果框
            $('#search-results').empty()
        }
        $('#search-results').append(result_item)
        // 给结果条添加悬浮效果
        result_item.hover(mouse_in, mouse_out)
    }
    if (matchedCount === 0) {
        $('#search-results').empty()
        $('#search-results').append($("<div id=\"empty-result\">暂无结果</div>"));
    }
}


function get_result_excerpt(text, targetIndex, matchedLength) {
    var overflow = 88;
    var startIndex = targetIndex - overflow
    if (startIndex < 0) {
        startIndex = 0;
    }
    var endIndex = targetIndex + overflow
    if (endIndex > text.length) {
        endIndex = text.length
    }

    return text.slice(startIndex, targetIndex) +
        '<mark>' + text.slice(targetIndex, targetIndex + matchedLength) + '</mark>' +
        text.slice(targetIndex + matchedLength, endIndex)
}

function get_resultExcerpt_withoutMark(text) {
    var overflow = 88;
    var endIndex = overflow * 2
    if (endIndex > text.length) {
        endIndex = text.length
    }
    return text.slice(0, endIndex)
}

function get_title_text(text, targetIndex, matchedLength) {
    return text.slice(0, targetIndex) +
        '<mark>' + text.slice(targetIndex, targetIndex + matchedLength) + '</mark>' +
        text.slice(targetIndex + matchedLength, text.length)
}


