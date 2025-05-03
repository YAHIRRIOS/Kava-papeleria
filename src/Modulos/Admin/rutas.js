const express = require('express');
const router = express.Router();
const adminController = require('./controller');

// Middleware para proteger rutas del admin
function verificarAdmin(req, res, next) {
  if (req.session && req.session.admin) {
    next();
  } else {
    res.redirect('/usuarios/login?mensaje=Debes iniciar sesión como administrador');
  }
}

router.get('/gestionarProductos', verificarAdmin, adminController.gestionarProductos)
router.get('/gestionarStock', verificarAdmin, adminController.gestionarStock)
router.post('/actualizarStock', verificarAdmin, adminController.actualizarStock)
// (Puedes agregar más rutas de admin aquí)
// Ruta para generar reportes
router.post('/generarReporte', verificarAdmin,adminController.generarReporte);
router.get('/generarReportes',verificarAdmin, adminController.mostrarGenerarReportes);



module.exports = router;
