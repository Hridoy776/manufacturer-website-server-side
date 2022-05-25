const express = require('express')
const cors = require('cors');
require("dotenv").config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.g9ujg.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect()
        const toolCollection = client.db('DrillDestructor').collection('tools');
        const userCollection = client.db('DrillDestructor').collection('users');
        const orderCollection = client.db('DrillDestructor').collection('orders');

        app.get('/tools', async (req, res) => {
            const query = {}
            const result = await toolCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/tool/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await toolCollection.findOne(query)
            res.send(result)
        })

        app.post('/order', async (req, res) => {
            const newOrder = req.body;


            const result = await orderCollection.insertOne(newOrder)
            res.send({ success: true, result })
        })

        app.get('/order', async (req, res) => {
            const email = req.query.email;
            const query = { email }
            const result = await orderCollection.find(query).toArray()
            res.send(result)
        })

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
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            console.log(email)
            const query = { email }
            
            const result = await userCollection.findOne(query)
            res.send(result)

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