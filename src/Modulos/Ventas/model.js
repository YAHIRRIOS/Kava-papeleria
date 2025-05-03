const mongoose = require('mongoose');

const direccionSchema = new mongoose.Schema({
  calle: String,
  ciudad: String,
  codigoPostal: String,
  pais: String
}, { _id: false });

const productoCompradoSchema = new mongoose.Schema({
  producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto', required: true },
  nombre: String, // por si el producto se elimina, mantienes un registro
  cantidad: { type: Number, required: true },
  precioUnitario: { type: Number, required: true }
}, { _id: false });

const ventaSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  productos: [productoCompradoSchema],
  total: { type: Number, required: true },
  direccionEnvio: direccionSchema,
  fecha: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Venta', ventaSchema);
