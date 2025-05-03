const Producto = require('./model'); // Ajusta la ruta si tu modelo está en otra carpeta
const Usuario = require('../Usuarios/model')
// Agregar un nuevo producto
exports.agregarProducto = async (req, res) => {

    const { nombre, descripcion, precio, stock } = req.body;

    // Verificar si la imagen se ha recibido correctamente
    let imagen = '';
    if (req.file) {
        // Asegurarnos de que la ruta de la imagen es la correcta
        imagen = `/uploads/${req.file.filename}`;
    } else {
        console.log('❌ No se ha recibido archivo de imagen');
    }

    try {
        const nuevoProducto = new Producto({
            nombre,
            descripcion,
            precio,
            stock,
            imagen
        });

        await nuevoProducto.save();
        console.log('✅ Producto agregado correctamente');
        res.redirect('/admin/gestionarProductos');
    } catch (err) {
        console.error('❌ Error al agregar producto:', err);
        res.status(500).send('Error al agregar el producto');
    }
};


// Eliminar producto por ID
exports.eliminarProducto = async (req, res) => {
    const { productoId } = req.body;

    console.log('🆔 ID recibido para eliminar:', productoId);

    try {
        await Producto.findByIdAndDelete(productoId); 
        console.log(`✅ Producto con ID ${productoId} eliminado`);
        res.redirect('/admin/gestionarProductos');
    } catch (err) {
        console.error('❌ Error al eliminar producto:', err);
        res.status(500).send('Error al eliminar el producto');
    }
};


exports.mostrarProductosPublicos = async (req, res) => {
  try {
    const productos = await Producto.find({ stock: { $gt: 0 } }); // 👈 Solo productos con stock > 0
    res.render('Index', { productos });
  } catch (error) {
    console.error('Error al obtener productos para el index:', error);
    res.status(500).send('Error al cargar productos');
  }
};

exports.mostrarDetalleProducto = async (req, res) => {
    try {
      const producto = await Producto.findById(req.params.id);
      if (!producto) {
        return res.status(404).send('Producto no encontrado');
      }
  
      // Se obtiene el carrito del usuario logueado
      let carrito = [];
  
      if (req.session.usuarioId) {
        const usuario = await Usuario.findById(req.session.usuarioId).populate('carrito.producto');
        carrito = usuario?.carrito || []; // Asegurarse de que el carrito esté presente
      }
  
      // Renderizar la vista pasando el producto y el carrito
      res.render('productoSeleccionado', { producto, carrito });
  
    } catch (err) {
      console.error('❌ Error al buscar producto:', err);
      res.status(500).send('Error al obtener el producto');
    }
  };
  
  exports.buscarProducto = async (req, res) => {
    const nombreBuscado = req.query.nombre;
  
    try {
      const productos = await Producto.find({
        nombre: { $regex: new RegExp(nombreBuscado, 'i') }  // 'i' ignora mayúsculas/minúsculas
      });
  
      res.render('busquedaResultados', { productos, query: nombreBuscado });
    } catch (error) {
      console.error('Error al buscar productos:', error);
      res.status(500).send('Error al buscar productos');
    }
  };
  


