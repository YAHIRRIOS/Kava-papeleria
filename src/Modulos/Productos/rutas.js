const express = require('express');
const router = express.Router();
const productosController = require('./controller');
const upload = require('../../multer'); //  el que cambia según el entorno
const { asegurarAutenticado} = require('../../middlewares/authmiddleware')


router.post('/agregar', asegurarAutenticado, upload.single('imagen'), productosController.agregarProducto);
router.post('/eliminar',asegurarAutenticado, productosController.eliminarProducto);
router.get('/catalogo',asegurarAutenticado, productosController.mostrarProductosPublicos);
router.get('/detalle/:id',asegurarAutenticado, productosController.mostrarDetalleProducto);
router.get('/buscar', asegurarAutenticado,productosController.buscarProducto);

module.exports = router;
