const router = require("express").Router();
const mongoose = require("mongoose");
const bodyParser = require('body-parser');
const axios = require("axios");

const newsSchema = new mongoose.Schema({
  title: String,
  description: String,
  date: String,
  coverUrl: String,
  new: Boolean,
  head1: String,
  head2: String,
  head3: String,
  article1: String,
  article2: String,
  article3: String,
  img1URL: String,
  img2URL: String,
});

const News = mongoose.model('News', newsSchema);

const getGoogleDriveFileId = (url) => {
  const match = url.match(/\/d\/(.*?)\//);
  return match ? match[1] : null;
};

const fetchImage = async (url) => {
  const fileId = getGoogleDriveFileId(url);
  if (!fileId) {
    throw new Error('Invalid Google Drive URL');
  }

  const googleDriveUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
  try {
    const response = await axios.get(googleDriveUrl, {
      responseType: 'arraybuffer',
    });
    const base64Image = Buffer.from(response.data, 'binary').toString('base64');
    const contentType = response.headers['content-type'];
    return `data:${contentType};base64,${base64Image}`;
  } catch (error) {
    throw new Error('Error fetching image from Google Drive');
  }
};

router.get('/featured', async (req, res) => {
  try {
    const featuredNews = await News.find({});
    const posts = await Promise.all(
      featuredNews.map(async (post) => {
        const coverUrl = await fetchImage(post.coverUrl);
        const img1URL = await fetchImage(post.img1URL);
        const img2URL = await fetchImage(post.img2URL);
        return { ...post.toObject(), coverUrl, img1URL, img2URL };
      })
    );
    res.json(posts);
  } catch (error) {
    res.status(500).send('Error fetching featured news');
  }
});

module.exports = router;
module.exports.News = News;
