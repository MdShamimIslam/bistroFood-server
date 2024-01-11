const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const menuCollection = client.db("BistroFood").collection("menus");
    const reviewCollection = client.db("BistroFood").collection("reviews");
    const cartCollection = client.db("BistroFood").collection("carts");
    const userCollection = client.db("BistroFood").collection("users");


    // user related api
    app.post('/users',async(req,res)=>{
      const user = req.body;
      const query = { email : user?.email}
      const existingEmail = await userCollection.findOne(query);
      if(existingEmail){
        return res.send({message:'Already exist the email',insertedId:null})
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    // cart related api
    app.get('/carts', async(req,res)=>{
      const email=req.query.email;
      if(!email){
        return res.send([])
      }
      const query = { email : email};
      const result=await cartCollection.find(query).toArray();
      res.send(result);
    })

    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.delete('/carts/:id',async(req,res)=>{
      const id = req.params.id;
      const query = { _id : new ObjectId(id)};
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })

   

    // menu related api
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    // review related api
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Bistro server is running...");
});

app.listen(port, (req, res) => {
  console.log(`Bistro server is running on port : ${port}`);
});
