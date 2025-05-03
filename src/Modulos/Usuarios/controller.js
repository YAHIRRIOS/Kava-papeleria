const nodemailer = require('nodemailer');
const Usuario = require('./model');
const Admin = require('../Admin/model')
const Producto = require('../Productos/model')
const Venta = require('./../Ventas/model')
// Mostrar formulario de login
exports.loginForm = (req, res) => {
  const mensaje = req.query.mensaje || null;
  res.render('Login', { mensaje });
};

// Mostrar formulario de registro
exports.registerForm = (req, res) => {
  const mensaje = req.query.mensaje || null;
  res.render('Registro', { mensaje });
};

// Mostrar formulario de recuperación
exports.recuperarContrasenaForm = (req, res) => {
  const mensaje = req.query.mensaje || null;
  res.render('correo-recuperar', { mensaje });
};

// Registrar nuevo usuario
exports.crearUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;

    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) {
      return res.redirect('/usuarios/registerForm?mensaje=El usuario ya existe');
    }

    const nuevoUsuario = new Usuario({ email, password });
    await nuevoUsuario.save();

    return res.redirect('/usuarios/login?mensaje=Usuario registrado con éxito');
  } catch (error) {
    return res.redirect('/usuarios/registerForm?mensaje=Error al crear el usuario');
  }
};
exports.loginUsuario = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Primero revisamos si es un admin
    const admin = await Admin.findOne({ email });
    if (admin) {
      if (admin.password !== password) {
        return res.redirect('/usuarios/login?mensaje=La contraseña es incorrecta');
      }

      req.session.admin = admin;
      return res.redirect('/admin/gestionarProductos');
    }

    // Si no es admin, entonces es un usuario normal
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.redirect('/usuarios/login?mensaje=El usuario es incorrecto');
    }

    if (usuario.password !== password) {
      return res.redirect('/usuarios/login?mensaje=La contraseña es incorrecta');
    }

    req.session.usuario = usuario;
    req.session.usuarioId = usuario._id; // ✅ ESTA LÍNEA AGREGA EL ID A LA SESIÓN

    return res.redirect('/productos/catalogo');
  } catch (error) {
    console.error(error);
    return res.redirect('/usuarios/login?mensaje=Error del servidor. Intenta de nuevo');
  }
};

// Enviar código de recuperación al correo
exports.enviarCodigoRecuperacion = async (req, res) => {
  const { email } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.redirect('/usuarios/recuperar?mensaje=Correo no registrado');
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date() + 10 * 60 * 1000;

    usuario.resetCode = codigo;
    usuario.resetCodeExpiration = expiracion;
    await usuario.save();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'reccontra965@gmail.com',
        pass: 'zxcf xcvj bkrt ydku'
      }
    });

    const mailOptions = {
      from: 'reccontra965@gmail.com',
      to: email,
      subject: 'Código de recuperación',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Recuperación de Contraseña</h2>
          <p>Tu código de recuperación es:</p>
          <h3 style="color: #007bff;">${codigo}</h3>
          <p>Este código expirará en 1 minuto.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.render('nueva-contrasena', { mensaje: 'Código enviado a tu correo' });
  } catch (error) {
    console.error(error);
    res.redirect('/recuperar?mensaje=Error al enviar el código');
  }
};

// Actualizar contraseña con el código recibido
exports.actualizarContrasena = async (req, res) => {
  const { code, newPassword } = req.body;

  try {
    const usuario = await Usuario.findOne({
      resetCode: code,
      resetCodeExpiration: { $gte: new Date(Date.now() - 60000) }
    });

    if (!usuario) {
      return res.render('nueva-contrasena', { mensaje: 'Código inválido o expirado' });
    }

    usuario.password = newPassword;
    usuario.resetCode = null;
    usuario.resetCodeExpiration = null;
    await usuario.save();

    return res.redirect('/usuarios/login?mensaje=Contraseña actualizada. Iniciá sesión.');
  } catch (error) {
    console.error(error);
    return res.render('nueva-contrasena', {
      mensaje: 'Error al actualizar la contraseña, solicitá otro código.'
    });
  }
};
exports.agregarAlCarrito = async (req, res) => {
  const { productoId, cantidad } = req.body;
  const userId = req.session.usuarioId;

  // Validar cantidad
  const cantidadNumerica = parseInt(cantidad);
  if (!cantidad || isNaN(cantidadNumerica) || cantidadNumerica <= 0) {
    req.session.errorMessage = 'Cantidad inválida. Por favor, ingresa un número válido.';
    return res.redirect(`/productos/detalle/${productoId}`);
  }

  try {
    const usuario = await Usuario.findById(userId);
    const producto = await Producto.findById(productoId);

    if (!producto) {
      return res.status(404).send('Producto no encontrado');
    }

    if (cantidadNumerica > producto.stock) {
      req.session.errorMessage = `Solo hay ${producto.stock} unidades disponibles de este producto.`;
      return res.redirect(`/productos/detalle/${productoId}`);
    }

    const index = usuario.carrito.findIndex(item => item.producto.equals(productoId));

    if (index >= 0) {
      const nuevaCantidad = usuario.carrito[index].cantidad + cantidadNumerica;
      if (nuevaCantidad > producto.stock) {
        req.session.errorMessage = `No puedes agregar más de ${producto.stock} unidades al carrito.`;
        return res.redirect(`/productos/detalle/${productoId}`);
      }
      usuario.carrito[index].cantidad = nuevaCantidad;
    } else {
      usuario.carrito.push({
        producto: productoId,
        cantidad: cantidadNumerica
      });
    }

    await usuario.save();
    res.redirect('/productos/catalogo');
  } catch (err) {
    console.error('Error al agregar al carrito:', err);
    res.status(500).send('Error al agregar al carrito');
  }
};

exports.mostrarCarrito = async (req, res) => {
  const userId = req.session.usuarioId;

  try {
    if (!userId) {
      return res.redirect('/usuarios/login?mensaje=Debes iniciar sesión para ver el carrito');
    }

    const usuario = await Usuario.findById(userId).populate('carrito.producto');
    const productos = await Producto.find();

    const errorMessage = req.session.errorMessage;
    delete req.session.errorMessage; // Limpiar después de mostrarlo

    res.render('Index', {
      carrito: usuario.carrito,
      productos,
      errorMessage
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al cargar el carrito');
  }
};


exports.actualizarCantidadCarrito = async (req, res) => {
  const { productoId, cantidad } = req.body;
  const userId = req.session.usuarioId;

  try {
    const cantidadInt = parseInt(cantidad);
    if (isNaN(cantidadInt) || cantidadInt <= 0) {
      req.session.errorMessage = 'La cantidad ingresada no es válida.';
      return res.redirect('/usuarios/carrito');
    }

    const usuario = await Usuario.findById(userId);
    const producto = await Producto.findById(productoId);

    if (!producto) {
      req.session.errorMessage = 'El producto ya no está disponible.';
      return res.redirect('/usuarios/carrito');
    }

    if (cantidadInt > producto.stock) {
      req.session.errorMessage = `Solo hay ${producto.stock} unidades disponibles.`;
      return res.redirect('/usuarios/carrito');
    }

    const index = usuario.carrito.findIndex(item => item.producto.equals(productoId));

    if (index >= 0) {
      usuario.carrito[index].cantidad = cantidadInt;
      await usuario.save();
      return res.redirect('/usuarios/carrito');
    }

    req.session.errorMessage = 'El producto no está en el carrito.';
    res.redirect('/usuarios/carrito');

  } catch (err) {
    console.error(err);
    req.session.errorMessage = 'Ocurrió un error al actualizar la cantidad.';
    res.redirect('/usuarios/carrito');
  }
};



exports.eliminarDelCarrito = async (req, res) => {
  const { productoId } = req.params;
  const userId = req.session.usuarioId;

  try {
    const usuario = await Usuario.findById(userId);

    // Eliminar el producto del carrito
    usuario.carrito = usuario.carrito.filter(item => !item.producto.equals(productoId));
    await usuario.save();

    res.redirect('/usuarios/carrito'); // Redirigir nuevamente al carrito
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al eliminar el producto del carrito');
  }
};

//Modificar Datos del Usuario

exports.modificardatosForm = (req,res) => {
  const mensaje = req.query.mensaje || null;
  res.render('modificarDatos', { mensaje });
}

exports.modificarDatos = async (req, res) => {
  try {
    const { 'user-email': nuevoEmail, 'user-password': nuevaPassword, 'user-confirm-password': passwordActual } = req.body;
    const usuarioId = req.session.usuarioId; // Asegúrate de tener esto al iniciar sesión

    if (!usuarioId) {
      return res.status(401).send('No has iniciado sesión');
    }

    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
      return res.status(404).send('Usuario no encontrado');
    }

    if (usuario.password !== passwordActual) {
      return res.status(403).send('La contraseña actual es incorrecta');
    }

    let cambios = false;

    if (nuevoEmail && nuevoEmail !== usuario.email) {
      usuario.email = nuevoEmail;
      cambios = true;
    }

    if (nuevaPassword) {
      usuario.password = nuevaPassword;
      cambios = true;
    }

    if (!cambios) {
      return res.status(400).send('No se detectaron cambios para actualizar');
    }

    await usuario.save();

    res.redirect('/usuarios/modificarDatos?mensaje=Datos actualizados con exito'); // O cualquier otra ruta después de modificar datos
  } catch (error) {
    console.error('Error al modificar datos:', error);
    res.status(500).send('Error del servidor');
  }
};



exports.obtenerHistorialPedidos = async (req, res) => {
  const usuarioId = req.session.usuarioId;

  // Verificar si el usuario tiene sesión activa
  if (!usuarioId) {
    req.session.errorMessage = 'Debes iniciar sesión para ver tu historial de pedidos.';
    return res.redirect('/usuarios/login');
  }

  try {
    const ventas = await Venta.find({ usuario: usuarioId }).sort({ fecha: -1 });

    res.render('historialPedidos', {
      ventas
    });
  } catch (error) {
    console.error('Error al obtener historial de pedidos:', error);
    res.status(500).send('Ocurrió un error al cargar el historial de pedidos.');
  }
};