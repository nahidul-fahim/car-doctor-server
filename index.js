const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;


// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());


// Creating custom Middlewares

// URL checker middleware
const logger = async(req, res, next) => {
    console.log("Called:", req.host, req.originalUrl)
    next();
};

// Token verifier custom Middleware
const verifyToken = async(req, res, next) => {
    const token = req.cookies?.token;
    console.log("Token from token verifier middleware:", token)
    if(!token){
        res.status(401).send({message: "Unauthorized user"})
    }
    // verify token
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded) {
        if(err){
            console.log("Error in token verifier: ", err)
            return res.status(401).send({message: 'Unauthorized user'})
        }
        console.log("Token verify success! ", decoded);
        req.decoded = decoded;
        next();
    })
};



// Database & password info from hidden file
const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASS;

// MongoDB code snippet
const uri = `mongodb+srv://${dbUser}:${dbPass}@cluster0.xeklkbf.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // Database and collection
        const serviceCollection = client.db("carDoctor").collection("services");
        const bookingCollection = client.db("carDoctor").collection("bookings");


        // JWT + Auth related api (Creating token and sending and recieving cookie)
        app.post("/jwt", async(req, res) => {
            const user = req.body;
            console.log(user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
            res
            .cookie('token', token, {
                httpOnly: true,
                secure: false,
                // sameSite: 'none',
            } )
            .send({success: true});
        })


        // Get all the services
        app.get("/services", async (req, res) => {
            const cursor = serviceCollection.find();
            const result = await cursor.toArray();
            res.send(result)
        })


        // Get a specific service
        app.get("/services/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const options = {
                projection: { title: 1, price: 1, service_id: 1, img: 1 },
            };
            const result = await serviceCollection.findOne(query, options);
            res.send(result);
        })


        // Get services for cart page according to email
        app.get("/cart/:email", logger, verifyToken, async (req, res) => {
            console.log( "Success token verify info -" , req.decoded)
            const email = req.params.email;
            const query = { email: email };
            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        })

        // Insert a booking service
        app.post("/cart", async (req, res) => {
            const booking = req.body;
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })

        // Delete a cart item
        app.delete("/cart/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        })


        // Update status of a cart item
        app.patch("/cart/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateBooking = req.body;
            console.log("check body from clint side", updateBooking);
            const updateDoc = {
                $set: {
                    status: updateBooking.status
                },
            };
            const result = await bookingCollection.updateOne(filter, updateDoc);
            res.send(result);
        })




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);






// Checking if the server is running
app.get("/", (req, res) => {
    res.send("Car doctor server is running fine")
})

// Port declaration
app.listen(port, () => {
    console.log(`Server is running on port: ${port}`)
})