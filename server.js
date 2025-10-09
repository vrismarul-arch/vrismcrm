require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// ✅ Middleware
app.use(cors());
const corsOptions = {
    origin: ["https://crm.megacrane.acculermedia.in"],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.use(express.json());

// ✅ Route files
const businessRoutes = require('./routes/businessAccountRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const brandServiceRoutes = require('./routes/brandServiceRoutes');
const taskRoutes = require("./routes/taskRoutes");
const departmentRoutes = require('./routes/departmentRoutes'); 
const teamRoutes = require('./routes/teamRoutes'); 
const workSessionRoutes = require('./routes/workSessionRoutes');

// ✅ Route mounting
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes); 
app.use('/api/teams', teamRoutes);
app.use('/api/accounts', businessRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/service', brandServiceRoutes);
app.use("/api/tasks", taskRoutes);
app.use('/api/work-sessions', workSessionRoutes); 

// ✅ Test route (optional)
app.get('/api/test', (req, res) => {
    res.json({ message: 'Server is working fine 🎉' });
});

// ✅ Connect DB and start server
connectDB().then(() => {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`🌍 Server running at http://localhost:${PORT}`);
    });
});
