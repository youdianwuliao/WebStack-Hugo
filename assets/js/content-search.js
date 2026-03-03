//关键词sug
var hotList = 0;
//防抖函数
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
$(function() {
    //当键盘键被松开时发送Ajax获取数据 - 添加防抖优化
    var searchHandler = debounce(function() {
        var keywords = $('#search-text').val();
        if (keywords == '') { $('#word').hide(); return };
        $.ajax({
            url: 'https://suggestion.baidu.com/su?wd=' + keywords,
            dataType: 'jsonp',
            jsonp: 'cb',
            beforeSend: function() {},
            success: function(res) {
                $('#word').empty().show();
                hotList = res.s.length;
                if (hotList) {
                    $("#word").css("display", "block");
                    var html = '';
                    for (var i = 0; i < hotList-1; i++) {
                        var spanStyle = '';
                        if (i === 0) {
                            spanStyle = 'style="color:#fff;background:#f54545"';
                        } else if (i === 1) {
                            spanStyle = 'style="color:#fff;background:#ff8547"';
                        } else if (i === 2) {
                            spanStyle = 'style="color:#fff;background:#ffac38"';
                        }
                        html += '<li><span ' + spanStyle + '>' + (i + 1) + '</span>' + res.s[i] + '</li>';
                    }
                    $("#word").html(html);
                } else {
                    $("#word").css("display", "none")
                }
            },
            error: function() {
                $('#word').empty().show();
                $('#word').hide();
            }
        })
    }, 300); //300ms防抖延迟

    $('#search-text').keyup(function(e) {
        //忽略方向键
        if (e.keyCode >= 37 && e.keyCode <= 40) return;
        searchHandler();
    })

    //点击搜索数据复制给搜索框
    $(document).on('click', '#word li', function() {
        var word = $(this).text().replace(/^[0-9]/, '');
        $('#search-text').val(word);
        $('#word').empty();
        $('#word').hide();
        $('.submit').trigger('click');
    })

    $(document).on('click', '.io-grey-mode', function() {
        $('#word').empty();
        $('#word').hide();
    })

})
