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
var showHide = window.location.href.endsWith('/hide/')
var usedBlogs = 0
var lastMouseX, lastMouseY;

$.get("/feed.xml", function (data) {
    blogs = $(data).find("item")
    for (let i = 0; i < blogs.length; i++) {
        // 隐藏部分搜索内容
        var hideTag = washTag($(blogs[i]).find("hideTag").text())
        if ((showHide && hideTag === 'false') ||
            (!showHide && hideTag === 'true')) {
            continue
        }

        titles.push(washTag($(blogs[i]).find("title").text()))
        links.push(washTag($(blogs[i]).find("link").text()))
        var content = $(blogs[i]).find("content").text()
        var cleanContent = washContent(content)
        contents.push(cleanContent)
        mainTag.push(washTag($(blogs[i]).find("mainTag").text()))
        secondaryTag.push(washTag($(blogs[i]).find("secondaryTag").text()))
        usedBlogs++
    }
})

$(document).ready(function () {
    // 不知道为啥文档就绪事件会触发两次，通过data标志位，判断事件是否已经被监听，防止多次监听事件带来的方法多次执行问题
    // https://blog.51cto.com/u_16175504/7284150
    var $body = $("body")
    if (!$body.data("search-shortcut")) {
        $body.on("keydown", function (e) {
            // ctrl + k 打开搜索
            if (e.ctrlKey && e.which === 75) {
                open_search_bar()
                e.preventDefault()
            }
        })
        $body.data("search-shortcut", true)
    }
    search_text()
})

// 开关搜索栏
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
        $si.off('keyup');
        $si.off('keydown');

        // ESC退出搜索
        $sb.on("keyup", function (e) {
            switch (e.keyCode) {
                case 27: // ESC
                    close_search_bar()
                    break;
                case 13: // 回车键
                    open_result();
                    break;
                case 38: // 上键
                    up_key();
                    break;
                case 40: // 下键
                    down_key();
                    break;
            }
        });
        $body.data("The result index of being selected", -1)
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

// 用于页面初始化时 自动解析 搜索字段
function search_text() {
    // 解析 URL 参数
    var params = getUrlParams(window.location.search);
    if (!params.hasOwnProperty('search_text')) {
        return
    }
    if (window.find && window.getSelection) {
        document.designMode = "on";
        var sel = window.getSelection();
        sel.collapse(document.body, 0);
        while (window.find(params['search_text'])) {
            // 设置背景色
            document.execCommand("HiliteColor", false, "darkgreen");
            // 设置文字颜色
            document.execCommand("ForeColor", false, "#b5e853");
            sel.collapseToEnd();
        }
        document.designMode = "off";
    }
}

function getUrlParams(queryString) {
    var params = {};
    var queries = queryString.substring(1).split("&");
    for (var i = 0; i < queries.length; i++) {
        var pair = queries[i].split("=");
        params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
    }
    return params;
}


// 各种动作
function start_search() {
    $("body").data("The result index of being selected", -1)
    var $si = $('#search-input')
    if ($si.length === 0) {
        return
    }
    if ($si.val() === '' || $si.val().search(/^\s+$/) >= 0) { // 没有字符或者多个空白字符的情况
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
    for (i = 0; i < usedBlogs; i++) {

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
        var result_item = $('<a href="' + links[i] + '" class="result-a" target="_blank">')
        result_item.append(rd)
        if (matchedCount === 1) {
            // 找到第一个结果, 则清空结果框
            $('#search-results').empty()
        }
        $('#search-results').append(result_item)
        // 给结果条添加悬浮效果
        result_item.hover(mouse_in, mouse_out)
        $("body").on('mousemove', function (event) { // 全局鼠标移动都要记录鼠标位置 为了mouse_in
            lastMouseX = event.pageX
            lastMouseY = event.pageY
        })
        result_item.on('mousemove', flush_select_effect)
    }
    if (matchedCount === 0) {
        $('#search-results').empty()
        $('#search-results').append($("<div id=\"empty-result\">暂无结果</div>"));
    }
}

function autoScroll(index) {
    var container = $('#search-results');
    var top = container.scrollTop()
    var bottom = container.scrollTop() + container.height()
    var curHeight = -1
    var $children = container.children();
    var hasStart = false
    var start = 0
    var end = 1
    var indexTopHeight = 0
    for (var i = 0; i < $children.length; i++) { // 遍历所有result，计算每一个result上边沿距离父容器的距离
        if (i === index) {
            indexTopHeight = curHeight
        }
        if (curHeight > top && !hasStart) {
            start = i
            hasStart = true
        }
        var child = $children.eq(i);
        curHeight += child.height() + 1 // 这个1是result-a这个class的border 1 理论来说应该读这个数而不是写死 我懒得搞了
        if (curHeight > top && curHeight <= bottom) {
            end = i;
        } else if (curHeight > bottom && i >= index) {
            break
        }
    }
    if (index >= start && index <= end) {
        return
    }
    container.animate({scrollTop: indexTopHeight}, 200);
}

function flush_select_effect() {
    // 效果全部消失
    $(".result-a").css("background", "transparent")
    // 重新设置指定块 出现选中效果
    var index = $("body").data("The result index of being selected")
    var $target = $('#search-results').children().eq(index)
    $target.css("background", "#202425")
}

function open_result() {
    var resIndex = $('body').data("The result index of being selected")
    if (resIndex === -1) return
    var result = $('#search-results').children().eq(resIndex)
    if (!result.attr("href").includes('search_text')) { // 防止重复添加搜索文本
        result.attr("href", result.attr("href") + "?search_text=" + $('#search-input').val())
    }
    result.get(0).click()
}

// 鼠标/键盘 快捷操作
function mouse_in(event) {
    if (this === event.target || $(this).has(event.target).length > 0) {
        if (event.pageX !== lastMouseX || event.pageY !== lastMouseY) {
            // 鼠标位置发生了变化 防止页面自动scroll 触发mouse in
            lastMouseX = event.pageX;
            lastMouseY = event.pageY;
            $("body").data("The result index of being selected", $(this).index())
        }
    }
}

function mouse_out(event) {
    // do nothing
}

function up_key() {
    var resNum = $('#search-results').children().length
    if (resNum === 0) return
    var $body = $("body")
    var curIndex = $body.data("The result index of being selected")
    var targetIndex = 0
    if (curIndex > 0) {
        targetIndex = curIndex - 1
    }
    $body.data("The result index of being selected", targetIndex)
    flush_select_effect()
    autoScroll(targetIndex)
}

function down_key() {
    var resNum = $('#search-results').children().length
    if (resNum === 0) return
    var $body = $("body")
    var curIndex = $body.data("The result index of being selected")
    var targetIndex = resNum - 1
    if (curIndex < resNum - 1) {
        targetIndex = curIndex + 1
    }
    $body.data("The result index of being selected", targetIndex)
    flush_select_effect()
    autoScroll(targetIndex)
}

// 文本处理
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

function washTag(text) {
    // 非贪婪模式匹配
    return text.replaceAll(/<.*?>/g, "").replaceAll("\n", " ").replaceAll(" ", "")
}

function washContent(text) {
    // 非贪婪模式匹配
    return text.replaceAll(/<.*?>/g, "").replaceAll("\n", " ")
}


