const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SK_KEY)
const jwt = require("jsonwebtoken");
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
    const paymentCollection = client.db("BistroFood").collection("payments");

    

    // jwt api

    // verify token
    const verifyToken = (req, res, next) => {
      const authHeaders = req.headers.authorization;
      if (!authHeaders) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = authHeaders.split(" ")[1];
      jwt.verify(token, process.env.SECRET_TOKEN, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };
    // create token
    app.post("/jwt", (req, res) => {
      const userEmail = req.body;
      const token = jwt.sign(userEmail, process.env.SECRET_TOKEN, {
        expiresIn: "5h",
      });
      res.send({ token });
    });

    // user related api

    // check admin (true or false)
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      // if (email !== req.decoded.email) {
      //   return res.status(401).send({ message: "Unauthorized access" });
      // }
      const user = await userCollection.findOne({ email });
      if (user?.role === "admin") {
        return res.send({ admin: true });
      }
      res.send({ admin: false });
    });

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // save the userInfo in mongoDB
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const existingEmail = await userCollection.findOne(query);
      if (existingEmail) {
        return res.send({
          message: "Already exist the email",
          insertedId: null,
        });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // cart related api
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        return res.send([]);
      }
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // menu related api
    app.get("/menu", async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      res.send(result);
    });

    app.post('/menu',verifyToken,verifyAdmin,async(req,res)=>{
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result)
    })

    app.put('/menu/:id',verifyToken,verifyAdmin,async(req,res)=>{
      const id = req.params.id;
      const menuItem = req.body;
      const query = { _id: new ObjectId(id) };
      const options = { upsert : true}
      const updatedDoc = {
        $set:{
          name:menuItem.name,
          image:menuItem.image,
          price:menuItem.price,
          recipe:menuItem.recipe,
          image:menuItem.image,
          category:menuItem.category,
        }
      }
      const result = await menuCollection.updateOne(query,updatedDoc,options);
      res.send(result);
    })

    app.delete('/menu/:id',verifyToken,verifyAdmin,async(req,res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })

    // review related api
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // payment related api
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types:['card']
      });
    
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // save payment information
    app.post('/payments-info',async(req,res)=>{
      const paymentInfo = req.body;
      const insertRes = await paymentCollection.insertOne(paymentInfo);
      // DELETE ITEM FROM CART
      const query = { _id : {
        $in : paymentInfo.cartIds.map(id => new ObjectId(id))
      }}
      const deleteRes = await cartCollection.deleteMany(query);
      res.send({insertRes,deleteRes}) 
    })

    app.get('/payments',verifyToken,async(req,res)=>{
      const email = req.query.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message:'Forbidden access'})
      }
      const result = await paymentCollection.find({email}).toArray();
      res.send(result);
    })

    app.delete('/payments/:id',verifyToken,async(req,res)=>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await paymentCollection.deleteOne(query);
      res.send(result);
    })

    // stats related api
    app.get('/admin-stats',verifyToken,verifyAdmin,async(req,res)=>{
      const users = await userCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      // get revenue (this is not the best way)
      // const payments = await paymentCollection.find().toArray();
      // const revenue = payments.reduce( (sum,payment)=> sum + payment.price , 0 );

      // its the best way to get revenue
      const result = await paymentCollection.aggregate([
      {
          $group : {
          _id : null,
          totalRevenue : {
            $sum : '$price'
          }
        }
      }
      ]).toArray();
      const revenue = result.length > 0 ? result[0].totalRevenue : 0 ;

      res.send({
        users,orders,menuItems,revenue
      })
    })

    // use aggregate pipeline
    app.get('/order-stats',async(req,res)=>{
      const result = await paymentCollection.aggregate([
        {
          $unwind : '$menuItemIds'
        },
        
       {
        $lookup : {
          from : 'menus',
          localField : 'menuItemIds',
          foreignField : '_id',
          as : 'menuItems'
        }
       }
      ]).toArray();
     
      res.send(result)
    })


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
  res.send("BistroFood server is running...");
});

app.listen(port, (req, res) => {
  console.log(`BistroFood server is running on port : ${port}`);
});
