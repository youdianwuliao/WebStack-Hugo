// 搜索建议功能已移除
$(function() {
    // 保留搜索框基本功能和回车提交
    $('#search-text').keyup(function(e) {
        if (e.keyCode === 13) {
            $('.submit').trigger('click');
        }
    });

    $(document).on('click', '.io-grey-mode', function() {
        $('#word').empty();
        $('#word').hide();
    });
});
