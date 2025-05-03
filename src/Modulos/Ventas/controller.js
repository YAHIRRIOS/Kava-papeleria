const Usuario = require('../Usuarios/model')
const Venta = require('./model')
const Producto = require('./../Productos/model')
const nodemailer = require('nodemailer');



const paypal = require('paypal-rest-sdk');

// Configurar el SDK de PayPal utilizando las variables de entorno
paypal.configure({
  mode: process.env.PAYPAL_MODE, // 'sandbox' o 'live'
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET
});
const axios = require('axios');

exports.crearOrden = async (req, res) => {
  const usuarioId = req.session.usuarioId;

  try {
    const usuario = await Usuario.findById(usuarioId).populate('carrito.producto');

    if (!usuario || !usuario.carrito || usuario.carrito.length === 0) {
      return res.status(400).send('Carrito vacío');
    }

    const total = usuario.carrito.reduce((acc, item) => {
      return acc + item.producto.precio * item.cantidad;
    }, 0).toFixed(2);

    // 1. Obtener token de acceso
    const basicAuth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString('base64');

    const tokenResponse = await axios.post(
      'https://api.sandbox.paypal.com/v1/oauth2/token',
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // 2. Crear la orden
    const orderResponse = await axios.post(
      'https://api.sandbox.paypal.com/v2/checkout/orders',
      {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'MXN',
            value: total
          }
        }]
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const orderID = orderResponse.data.id;
    res.json({ id: orderID });

  } catch (error) {
    console.error('Error al crear la orden:', error.response?.data || error);
    res.status(500).send('Error al crear la orden de PayPal');
  }
};

exports.capturarOrden = async (req, res) => {
  const { paymentID } = req.body; // Ya viene capturada desde el frontend
  const userId = req.session.usuarioId;
  const direccionId = req.session.direccionSeleccionada;

  console.log('paymentID recibido:', paymentID);

  try {
    // Procesar la venta localmente
    const usuario = await Usuario.findById(userId)
      .populate('carrito.producto')
      .exec();

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const direccion = usuario.direcciones.id(direccionId);
    if (!direccion) {
      return res.status(400).json({ error: 'Dirección no encontrada' });
    }

    let total = 0;
    const productosVendidos = [];

    for (const item of usuario.carrito) {
      const producto = item.producto;
      const cantidad = item.cantidad;

      if (producto.stock < cantidad) {
        return res.status(400).json({ error: `Stock insuficiente para el producto: ${producto.nombre}` });
      }

      producto.stock -= cantidad;
      await producto.save();

      const subtotal = producto.precio * cantidad;
      total += subtotal;

      productosVendidos.push({
        producto: producto._id,
        nombre: producto.nombre,
        cantidad,
        precioUnitario: producto.precio
      });
    }

    await Venta.create({
      usuario: userId,
      productos: productosVendidos,
      total,
      direccionEnvio: direccion,
      referenciaPaypal: paymentID // Puedes guardarla si deseas
    });

    usuario.carrito = [];
    await usuario.save();

    res.json({ success: true });

  } catch (error) {
    console.error('Error al registrar la orden localmente:', error);
    res.status(500).json({ error: 'Error al registrar la orden localmente' });
  }
};



exports.pagoExitoso = (req, res) => {
  try {
    res.render('pagoExitoso'); // Renderiza la vista de pago exitoso
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al mostrar la página de pago exitoso');
  }
};

exports.pagoCancelado = (req, res) => {
  try {
    res.render('pagoCancelado'); // Renderiza la vista de pago cancelado
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al mostrar la página de pago cancelado');
  }
};



// Configuración de Nodemailer con los datos de tu correo
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'reccontra965@gmail.com', // Tu correo de Gmail
    pass: 'zxcf xcvj bkrt ydku'    // Tu contraseña de Gmail (o app password si tienes la verificación en dos pasos)
  }
});

exports.confirmarCompra = async (req, res) => {
  const userId = req.session.usuarioId;
  const { carrito, total, direccionSeleccionadaId, paypalOrderId } = req.body;

  if (!userId) {
    return res.redirect('/usuarios/login');  // Redirigir a login si no está autenticado
  }

  try {
    const usuario = await Usuario.findById(userId);
    if (!usuario) {
      return res.redirect('/error');  // Redirigir a una página de error si no se encuentra al usuario
    }

    const direccion = usuario.direcciones.find(dir => dir._id.toString() === direccionSeleccionadaId);
    if (!direccion) {
      return res.redirect('/error');  // Redirigir si no se encuentra la dirección
    }

    const productosFormateados = [];

    for (const item of carrito) {
      const productoBD = await Producto.findById(item.producto);
      if (!productoBD) {
        return res.redirect('/error');  // Redirigir si un producto no se encuentra
      }

      productosFormateados.push({
        producto: productoBD._id,
        nombre: productoBD.nombre,
        cantidad: item.cantidad,
        precioUnitario: productoBD.precio
      });
    }

    const venta = new Venta({
      usuario: userId,
      productos: productosFormateados,
      total,
      direccionEnvio: direccion
    });

    await venta.save();

    // Enviar el correo de confirmación
    const mailOptions = {
      from: 'reccontra965@gmail.com',
      to: usuario.email,
      subject: 'Confirmación de Compra - Tu pedido ha sido recibido',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>¡Gracias por tu compra, ${usuario.email}!</h2>
          <p>Tu pedido ha sido recibido correctamente y será enviado a la siguiente dirección:</p>
          <p><strong>Dirección de envío:</strong></p>
          <p>${direccion.calle}, ${direccion.ciudad}, ${direccion.codigoPostal}, ${direccion.pais}</p>
          
          <h3>Detalles de tu pedido:</h3>
          <ul>
            <% venta.productos.forEach(producto => { %>
              <li><%= producto.nombre %> - <%= producto.cantidad %> x $<%= producto.precioUnitario %></li>
            <% }) %>
          </ul>
          
          <p><strong>Total: </strong>$${total}</p>
          <p><strong>Fecha de compra:</strong> ${new Date().toLocaleString()}</p>

          <p>Tu pedido será procesado y enviado lo antes posible. ¡Gracias por confiar en nosotros!</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    // Redirigir a la página de pago exitoso
    res.render('pagoExitoso', {
      mensaje: 'Compra realizada exitosamente',
      venta
    });

  } catch (err) {
    console.error('Error al confirmar compra:', err);
    res.render('pagoCancelado', {
      mensaje: 'Hubo un error al procesar la compra. Inténtalo nuevamente más tarde.'
    });
  }
};


exports.agregarDireccion = async (req, res) => {
    const { calle, ciudad, codigoPostal, pais } = req.body;
    const userId = req.session.usuarioId; // Asumiendo que manejas sesiones
  
    try {
      const usuario = await Usuario.findById(userId);
  
      if (!usuario) {
        return res.status(404).send('Usuario no encontrado');
      }
  
      if (usuario.direcciones.length >= 3) {
        return res.status(400).send('No puedes agregar más de 3 direcciones');
      }
  
      usuario.direcciones.push({ calle, ciudad, codigoPostal, pais });
      await usuario.save();
  
      res.redirect('/pago/SeleccionarDireccion'); // Redirige a la vista
    } catch (error) {
      console.error(error);
      res.status(500).send('Error al guardar la dirección');
    }
  };
  exports.verDirecciones = async (req, res) => {
    const userId = req.session.usuarioId;
  
    try {
      const usuario = await Usuario.findById(userId).populate('carrito.producto');
  
      if (!usuario) {
        return res.status(404).send('Usuario no encontrado');
      }
  
      // Verificar si el carrito está vacío
      if (usuario.carrito.length === 0) {
        req.session.errorMessage = 'Tu carrito está vacío. Agrega productos antes de proceder al pago.';
        return res.redirect('/productos/catalogo');
      }
  
      res.render('Direcciones', {
        direcciones: usuario.direcciones
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Error al obtener direcciones');
    }
  };
  

  
exports.eliminarDireccion = async (req, res) => {
    try {
        const userId = req.session.usuarioId; // Asumiendo que el ID del usuario está en la sesión
        const direccionId = req.params.id;

        // Buscar usuario
        const usuario = await Usuario.findById(userId);
        if (!usuario) return res.redirect('/usuarios/login')

        // Filtrar la dirección a eliminar
        usuario.direcciones = usuario.direcciones.filter(
            direccion => direccion._id.toString() !== direccionId
        );

        await usuario.save();

        res.redirect('/pago/seleccionarDireccion');
    } catch (err) {
        console.error('Error al eliminar dirección:', err);
        res.status(500).send('Error del servidor');
    }
};

exports.pagoPaypal = async (req, res) => {
  const userId = req.session.usuarioId;
  const { direccionSeleccionada } = req.body;
console.log(direccionSeleccionada)
  try {
    const usuario = await Usuario.findById(userId);

    if (!usuario) {
      return res.status(404).send('Usuario no encontrado');
    }

    if (!direccionSeleccionada) {
      return res.redirect('/direcciones?mensaje=Debes seleccionar una dirección');
    }

    // Guarda la dirección seleccionada en la sesión para usarla luego en la venta
    req.session.direccionSeleccionada = direccionSeleccionada;

    res.render('pagoPaypal'); // Aquí renderizas la vista con el botón de pagar con PayPal
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al acceder a la vista de pagos');
  }
};
