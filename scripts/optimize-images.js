const imagemin = require('imagemin').default;
const imageminJpegtran = require('imagemin-jpegtran');
const imageminPngquant = require('imagemin-pngquant').default;
const path = require('path');
const fs = require('fs');

(async () => {
    try {
        console.log('开始优化图片...');

        const files = await imagemin(['assets/images/**/*.{jpg,png}'], {
            destination: 'assets/images/optimized',
            plugins: [
                imageminJpegtran(),
                imageminPngquant({
                    quality: [0.6, 0.8]
                })
            ]
        });

        console.log(`成功优化 ${files.length} 个图片文件`);
        console.log('优化后的图片保存在: assets/images/optimized');

        let totalOriginal = 0;
        let totalOptimized = 0;

        files.forEach(file => {
            const originalSize = file.sourcePath ? fs.statSync(file.sourcePath).size : 0;
            const optimizedSize = file.data.length;
            totalOriginal += originalSize;
            totalOptimized += optimizedSize;

            const savings = originalSize > 0 ? ((originalSize - optimizedSize) / originalSize * 100).toFixed(2) : 0;
            console.log(`${path.basename(file.sourcePath || 'unknown')}: ${originalSize} -> ${optimizedSize} (节省 ${savings}%)`);
        });

        if (totalOriginal > 0) {
            const totalSavings = ((totalOriginal - totalOptimized) / totalOriginal * 100).toFixed(2);
            console.log(`\n总计节省: ${(totalOriginal - totalOptimized) / 1024}KB (${totalSavings}%)`);
        }

    } catch (error) {
        console.error('图片优化失败:', error);
        process.exit(1);
    }
})();
