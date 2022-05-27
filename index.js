const express = require('express')
const cors = require('cors');
require("dotenv").config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)
app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.g9ujg.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function JWtverify(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).send({ message: "UnAuthorized access" });
    }
    const token = authHeader.split(" ")[1];
    
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            console.log(err);
            return res.status(403).send({ message: "Forbidden access" });
        }
        req.decoded = decoded;

        next();
    });
}

async function run() {
    try {
        await client.connect()
        const toolCollection = client.db('DrillDestructor').collection('tools');
        const userCollection = client.db('DrillDestructor').collection('users');
        const reviewCollection = client.db('DrillDestructor').collection('reviews');
        const userInformationCollection = client.db('DrillDestructor').collection('information');
        const orderCollection = client.db('DrillDestructor').collection('orders');
        const paymentCollection = client.db('DrillDestructor').collection('payments');

        const AdminVerify = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({
                email: requester,
            });
            if (requesterAccount.role === "admin") {
                next();
            } else {
                res.status(403).send({ message: "forbidden" });
            }
        };

        app.get('/tools', async (req, res) => {
            const query = {}
            const result = await toolCollection.find(query).toArray()
            res.send(result)
        })
        app.post('/tools', async (req, res) => {
            const newTool=req.body;
            
            const result = await toolCollection.insertOne(newTool)
            res.send({result,success:true})
        })

        app.get('/tool/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await toolCollection.findOne(query)
            res.send(result)
        })
        app.delete('/tool/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await toolCollection.deleteOne(query)
            res.send(result)
        })

        app.post('/order', async (req, res) => {
            const newOrder = req.body;


            const result = await orderCollection.insertOne(newOrder)
            res.send({ success: true, result })
        })

        app.get('/allorder/:email',JWtverify,  async (req, res) => {

                const query = {}
                const result = await orderCollection.find(query).toArray()
                res.send(result)
            
        })
        app.get('/order', JWtverify, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = {email}
                const result = await orderCollection.find(query).toArray()
                res.send(result)
            }
        })
        app.get('/order/:id',  async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const query = { _id: ObjectId(id) }
            const result = await orderCollection.findOne(query)
            console.log(result)
            res.send(result)
        })
        app.patch('/order/:id', JWtverify, async (req, res) => {
            const id = req.params.id;
            const payment=req.body;
            const filter = { _id: ObjectId(id) }
            const updateDoc={
                $set:{
                    paid:true,
                    status:"panding",
                    transactionId:payment.transactionId,
                }
            }
            const result = await orderCollection.updateOne(filter,updateDoc)
            const updatedOrder=await paymentCollection.insertOne(payment)
            res.send(updateDoc)
        })

        app.patch('/order/shipping/:id', JWtverify, async (req, res) => {
            const id = req.params.id;
            
            const filter = { _id: ObjectId(id) }
            const updateDoc={
                $set:{
                    paid:true,
                    status:"shipped",
                    
                }
            }
            const result = await orderCollection.updateOne(filter,updateDoc)
            
            res.send(result)
        })

        app.delete('/order/:id', JWtverify, async (req, res) => {
            const id = req.params.id;
            
            const query = { _id: ObjectId(id) }
            const result = await orderCollection.deleteOne(query)

            res.send(result)
        })

        app.post("/create-payment-intent", JWtverify, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100
            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card'],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            
            const filter = { email }
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            }
            const result = await userCollection.updateOne(filter, updateDoc, options)
            
            const token = jwt.sign(
                { email: email },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: "1h" }
            );
            res.send({ result, token })



        })
        app.get('/user/:email', JWtverify, async (req, res) => {
            const email = req.params.email;
            const decodedEmail=req.decoded.email;
            
            const query = { email }

           if(email===decodedEmail){
            const result = await userCollection.findOne(query)
            return res.send(result)
           }

        })
        app.get('/user', JWtverify, AdminVerify, async (req, res) => {

            const query = {}

            const result = await userCollection.find(query).toArray()
            res.send(result)

        })

        app.put("/user/admin/:email", JWtverify, AdminVerify, async (req, res) => {
            const email = req.params.email;
            const filter = { email };
            const updateDoc = {
                $set: { role: "admin" },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;

            const user = await userCollection.findOne({ email })

            const isAdmin = user.role === "admin"
            res.send({ admin: isAdmin })
        })

        app.put("/user/information/:email", JWtverify, async (req, res) => {
            const email = req.params.email;
            const information = req.body;
            console.log(information)
            const filter = { email };
            const options = { upsert: true }
            const updateDoc = {
                $set: information,
            };
            const result = await userInformationCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        });

        app.get("/reviews",async(req,res)=>{
            const query={}
            const result= await reviewCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/reviews',async(req,res)=>{
            const newReview=req.body;
            
            const result=await reviewCollection.insertOne(newReview)
            res.send({result,success:true})
        })

    } finally {

    }
}
run().catch(console.dir)



app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})