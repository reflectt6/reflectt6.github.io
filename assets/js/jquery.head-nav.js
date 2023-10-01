/*
 * Copyright (c) 2023 reflectt6
 */

// var isBind = false

function open_head_nav_bar() {
    var $sb = $("#head-nav-background1")
    // var $hns = $("#head-nav-section")
    $sb.css("display", "flex")
    // if (!isBind) {
    //     // ESC退出搜索
    //     $hns.on("keypress", function (e) {
    //         e.preventDefault()
    //         if (e.keyCode === 27) {
    //             close_head_nav_bar()
    //         }
    //     });
    //     isBind = true
    // }
    $sb.on("click", other_method_close_head_nav_bar)
    // $hns.focus()
}

function close_head_nav_bar() {
    var $sb = $("#head-nav-background1")
    $sb.css("display", "none")
    $sb.off("click")
}

function other_method_close_head_nav_bar(event) {
    var $ss = $("#head-nav-section")
    if (!$ss.is(event.target) && $ss.has(event.target).length === 0) {
        close_head_nav_bar()
    }
}
