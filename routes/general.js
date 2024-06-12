const router = require("express").Router();
const mongoose = require("mongoose");


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

router.get('/featured', async (req, res) => {
  try {
    const featuredNews = await News.find({});
    res.json(featuredNews);
  } catch (error) {
    res.status(500).send('Error fetching featured news');
  }
});

const getGoogleDriveFileId = (url) => {
  const match = url.match(/\/d\/(.*?)\//);
  return match ? match[1] : null;
};

router.get('/image', async (req, res) => {
  const { url } = req.query;
  const fileId = getGoogleDriveFileId(url);
  if (!fileId) {
    return res.status(400).send('Invalid Google Drive URL');
  }

  const googleDriveUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
  try {
    const response = await axios.get(googleDriveUrl, {
      responseType: 'arraybuffer',
    });
    const base64Image = Buffer.from(response.data, 'binary').toString('base64');
    const contentType = response.headers['content-type'];
    res.json({ base64Image, contentType });
  } catch (error) {
    res.status(500).send('Error fetching image from Google Drive');
  }
});

module.exports = router;
module.exports.News = News;
