const express = require('express');
const session = require('express-session');
const config = require('./config');
const app = express();
const { usuarioRoutes } = require('./Modulos/Usuarios');
const { adminRoutes } = require('./Modulos/Admin');
const { productosRoutes } = require('./Modulos/Productos');
const Usuario = require('../src/Modulos/Usuarios/model');
const { listaRutas } = require('./Modulos/Lista-Deseos');
const mongoose = require('mongoose');
const { pagoRoutes } = require('./Modulos/Ventas');

// Configuración del puerto
app.set('port', config.app.port);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: config.secreto.Hash, // Cambiar esto por algo más seguro en producción
  resave: false,
  saveUninitialized: false,
  rolling: true,               // 🔄 Renueva la sesión con cada solicitud
  cookie: {
    secure: false,             // Cambiar a true en producción con HTTPS
    maxAge: 5 * 60 * 1000      // ⏱ 5 minutos
  }
}));

// Middleware para pasar el carrito a todas las vistas
app.use(async (req, res, next) => {
  if (req.session.usuarioId) {
    try {
      const usuario = await Usuario.findById(req.session.usuarioId).populate('carrito.producto');
      res.locals.carrito = usuario.carrito || [];
    } catch (err) {
      console.error('Error al obtener el carrito del usuario', err);
      res.locals.carrito = [];
    }
  } else {
    res.locals.carrito = [];
  }
  next();
});

app.use((req, res, next) => {
  res.locals.session = req.session;
  next();
});

// Middleware para deshabilitar caché en todas las vistas
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Conexión con MongoDB
mongoose.connect(config.db.mongoURI)
  .then(() => console.log('Conexión a MongoDB exitosa'))
  .catch(err => console.error('Error al conectar a MongoDB:', err));

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Archivos estáticos
app.use(express.static(__dirname + '/public'));

// Rutas
app.use('/pago', pagoRoutes);
app.use('/usuarios', usuarioRoutes);
app.use('/listaDeseos', listaRutas);
app.use('/admin', adminRoutes);
app.use('/productos', productosRoutes);

app.get('/', (req, res) => {
  res.render('Login');
});

module.exports = app;
