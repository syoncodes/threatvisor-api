const router = require("express").Router();
const mongoose = require("mongoose");


const newsSchema = new mongoose.Schema({
  title: String,
  description: String,
  date: String,
  coverUrl: String, // Assuming this is a URL to an image in Google Drive
  new: Boolean,
  head1: String,
  head2: String,
  head3: String,
  article1: String,
  article2: String,
  article3: String,
  img1URL: String, // Assuming this is a URL to an image in Google Drive
});

const News = mongoose.model('News', newsSchema);

module.exports = News;

router.get('/featured', async (req, res) => {
  try {
    const featuredNews = await News.find({});
    res.json(featuredNews);
  } catch (error) {
    res.status(500).send('Error fetching featured news');
  }
});

router.get('/image', async (req, res) => {
  const { url } = req.query;
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
    });
    res.set('Content-Type', response.headers['content-type']);
    res.send(response.data);
  } catch (error) {
    res.status(500).send('Error fetching image from Google Drive');
  }
});

module.exports = router;
module.exports.News = News;
