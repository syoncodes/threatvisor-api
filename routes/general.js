const router = require("express").Router();
const mongoose = require("mongoose");


const newsSchema = new mongoose.Schema({
  title: String,
  description: String,
  date: String,
  coverUrl: String, // Base64 encoded string
  new: Boolean,
  head1: String,
  head2: String,
  head3: String,
  article1: String,
  article2: String,
  article3: String,
  img1URL: String, // Base64 encoded string
  img2URL: String, // Base64 encoded string
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

module.exports = router;
module.exports.News = News;
