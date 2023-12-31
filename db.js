const mongoose = require("mongoose");

module.exports = () => {
	const connectionParams = {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	};
	try {
		mongoose.connect("mongodb://syonb:syonsmart@ac-0w6souu-shard-00-00.jfanqj5.mongodb.net:27017,ac-0w6souu-shard-00-01.jfanqj5.mongodb.net:27017,ac-0w6souu-shard-00-02.jfanqj5.mongodb.net:27017/?replicaSet=atlas-yytbi1-shard-0&ssl=true&authSource=admin", connectionParams);
		console.log("Connected to database successfully");
	} catch (error) {
		console.log(error);
		console.log("Could not connect database!");
	}
};
