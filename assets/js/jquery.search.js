/*
 * Copyright (c) 2023 reflectt6
 */

function open_search_bar() {
    var $sb = $("#search-background1")
    $sb.css("display", "flex")
    $sb.on("click", other_method_close_search_bar)
}

function close_search_bar() {
    var $sb = $("#search-background1")
    $sb.css("display", "none")
    $sb.off("click")
}

function other_method_close_search_bar(event) {
    var $sb = $("#search-background1")
    var $ss = $("#search-section")
    if (!$ss.is(event.target) && $ss.has(event.target).length === 0) {
        $sb.css("display", "none")
    }
}

$(document).ready(function () {
    var $ra = $(".result-a")
    $ra.hover(mouse_in, mouse_out)
})
function mouse_in(event) {
    $(this).each(function (index, element) {
        var e = $(element)
        if (e.has(event.target).length > 0) {
            e.css("background", "#202425")
            return
        }
    })
}

function mouse_out(event) {
    $(this).each(function (index, element) {
        var e = $(element)
        if (e.has(event.target).length > 0) {
            e.css("background", "transparent")
            return
        }
    })
}
