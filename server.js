const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const app = express();

// Allow all origins
app.use(cors());
app.use(express.json());

// Home route
app.get('/', (req, res) => {
    res.json({
        message: 'YouTube Downloader API is Working!',
        status: 'active',
        endpoints: {
            info: '/api/info?url=YOUTUBE_URL',
            download: '/api/download?url=YOUTUBE_URL&quality=QUALITY'
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get video info
app.get('/api/info', async (req, res) => {
    try {
        const url = req.query.url;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const info = await ytdl.getInfo(url);
        
        // Get available formats
        const formats = info.formats
            .filter(f => f.hasVideo || f.hasAudio)
            .map(f => ({
                quality: f.qualityLabel || (f.hasAudio && !f.hasVideo ? 'Audio' : f.quality),
                size: f.contentLength ? Math.round(f.contentLength / (1024 * 1024)) + ' MB' : 'Unknown'
            }));

        // Remove duplicates
        const uniqueFormats = [];
        const seen = new Set();
        formats.forEach(f => {
            if (!seen.has(f.quality)) {
                seen.add(f.quality);
                uniqueFormats.push(f);
            }
        });

        res.json({
            success: true,
            title: info.videoDetails.title,
            duration: formatTime(info.videoDetails.lengthSeconds),
            views: formatViews(info.videoDetails.viewCount),
            thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1]?.url,
            author: info.videoDetails.author.name,
            formats: uniqueFormats
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Download video
app.get('/api/download', async (req, res) => {
    try {
        const url = req.query.url;
        const quality = req.query.quality || 'highest';
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const info = await ytdl.getInfo(url);
        const title = cleanFilename(info.videoDetails.title);
        
        const isAudio = quality.includes('Audio');
        const filename = `${title}.${isAudio ? 'mp3' : 'mp4'}`;
        
        res.header('Content-Disposition', `attachment; filename="${filename}"`);
        
        ytdl(url, {
            quality: quality === 'highest' ? 'highest' : quality,
            filter: isAudio ? 'audioonly' : 'audioandvideo'
        }).pipe(res);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper functions
function formatTime(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatViews(views) {
    const num = parseInt(views);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M views';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K views';
    return num + ' views';
}

function cleanFilename(name) {
    return name.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_').substring(0, 50);
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
