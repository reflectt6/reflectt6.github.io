/*
 * Copyright (c) 2023 reflectt6
 */

function open_head_nav_bar() {
    var $sb = $("#head-nav-background1")
    if ($sb.length === 0) {
        return
    }
    var $body = $("body")
    $sb.css("display", "flex")
    if (!$body.data("esc_head_nav_shortcut")) {
        // ESC退出搜索 (这里绑定需要用body，如果绑定head-nav触发不了)
        $body.on("keyup", function (e) {
            if (e.keyCode === 27) {
                close_head_nav_bar()
                e.preventDefault()
            }
        });
        $body.data("esc_head_nav_shortcut", true)
    }
    $sb.on("click", other_method_close_head_nav_bar)
}

function close_head_nav_bar() {
    var $sb = $("#head-nav-background1")
    if ($sb.length === 0) {
        return
    }
    $sb.css("display", "none")
    $sb.off("click")
}

function other_method_close_head_nav_bar(event) {
    var $ss = $("#head-nav-section")
    if (!$ss.is(event.target) && $ss.has(event.target).length === 0) {
        close_head_nav_bar()
    }
}

$(document).ready(function () {
    // 不知道为啥文档就绪事件会触发两次，通过data标志位，判断事件是否已经被监听，防止多次监听事件带来的方法多次执行问题
    // https://blog.51cto.com/u_16175504/7284150
    var $body = $("body")
    if(!$body.data("catalogue-shortcut")) {
        $body.on("keydown", function (e) {
            // ctrl + l 打开目录
            if (e.ctrlKey && e.which === 76) {
                open_head_nav_bar()
                e.preventDefault()
            }
        })
        $body.data("catalogue-shortcut", true)
    }
})
