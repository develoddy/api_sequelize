import { Shipment } from '../models/Shipment.js';
import { Sale } from '../models/Sale.js';
import { SaleDetail } from '../models/SaleDetail.js';
import { SaleAddress } from '../models/SaleAddress.js';
import { Product } from '../models/Product.js';
import { Variedad } from '../models/Variedad.js';
import { File } from '../models/File.js';
import { User } from '../models/User.js';
import { Guest } from '../models/Guest.js';
import { Op } from 'sequelize';


// 🔹 Listado de envíos con búsqueda, paginación y timeFilter
export const getList = async (req, res) => {
  try {
    let { q, page = 1, limit = 20, timeFilter, status } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    const where = {};

    // Relaciones: Shipment -> Sale -> User
    const include = [
      {
        model: Sale,
        as: 'sale',
        include: [{ model: User, as: 'user', required: false }]
      }
    ];

    // 🔹 Filtro por estado
    if (status && status !== 'all') {
      where.status = status;
    }

    // 🔹 Filtro de búsqueda
    if (q) {
      const qLike = { [Op.like]: `%${q}%` };
      where[Op.or] = [
        { trackingNumber: qLike },
        { '$sale.id$': qLike },
        { '$sale.user.email$': qLike }
      ];
    }

    // 🔹 Filtro por Day/Week/Month
    if (timeFilter && timeFilter !== 'All') {
      const now = new Date();
      let from = null;
      let to = null;

      switch (timeFilter) {
        case 'Day':
          from = new Date();
          from.setHours(0, 0, 0, 0);
          to = new Date();
          to.setHours(23, 59, 59, 999);
          break;
        case 'Week':
          const dayOfWeek = now.getDay(); // 0 = domingo
          from = new Date(now);
          from.setDate(now.getDate() - dayOfWeek);
          from.setHours(0, 0, 0, 0);
          to = new Date();
          to.setHours(23, 59, 59, 999);
          break;
        case 'Month':
          from = new Date(now.getFullYear(), now.getMonth(), 1);
          to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
      }

      if (from || to) {
        where.createdAt = where.createdAt || {};
        if (from) where.createdAt[Op.gte] = from;
        if (to) where.createdAt[Op.lte] = to;
      }
    }

    // 🔹 Consulta principal con paginación
    const { count, rows } = await Shipment.findAndCountAll({
      where,
      include,
      distinct: true, // evita duplicados por joins
      limit,
      offset: (page - 1) * limit,
      order: [['createdAt', 'DESC']]
    });

    return res.json({
      success: true,
      total: count,
      page,
      pages: Math.ceil(count / limit),
      shipments: rows
    });

  } catch (err) {
    console.error('Error en getList:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};


// 🔹 Obtener un envío por ID
// export const getById = async (req, res) => {
//   try {
//     const shipment = await Shipment.findByPk(req.params.id, { include: ['sale'] });
//     if (!shipment) return res.status(404).json({ success: false, message: 'No results' });
//     return res.json({ success: true, shipment });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ success: false, message: err.message });
//   }
// };


export const getById = async (req, res) => {
  try {
    const shipment = await Shipment.findByPk(req.params.id, {
      include: [
        {
          model: Sale,
          as: 'sale', // 🔑 necesario porque el alias en Shipment es 'sale'
          include: [
            { model: User },
            { model: Guest },
            { model: SaleAddress },
          ],
        },
      ],
    });

    if (!shipment) return res.status(404).json({ success: false, message: 'No results' });

    // Obtener detalles de la venta con sus relaciones
    const details = await SaleDetail.findAll({
      where: { saleId: shipment.saleId },
      include: [
        { model: Product },
        { model: Variedad},
        { model: Sale },
      ],
    });

    // Mapear items para enviar imagen y demás info al front
    const items = await Promise.all(details.map(async d => {
      let image = null;
      if (d.product && d.product.portada) {
        image = `${process.env.URL_BACKEND}/api/products/uploads/product/${d.product.portada}`;
      } else if (d.variedad && d.variedad.Files && d.variedad.Files.length > 0) {
        image = d.variedad.Files[0].preview_url;
      }

      const variedadObj = d.variedad || d.variedade || null;
      const tallaVal = variedadObj ? (variedadObj.valor || variedadObj.name || variedadObj.valor_ ? variedadObj.valor_ : null) : null;

      // let variedadesProducto = [];
      // try {
      //   const pid = d.product && d.product.id ? d.product.id : (d.productId || null);
      //   if (pid) {
      //     variedadesProducto = await Variedad.findAll({ where: { productId: pid }});
      //   }
      // } catch (e) {
      //   console.warn('[DEBUG Admin] Error cargando variedades del producto para sale.detail:', e && e.message);
      //   variedadesProducto = [];
      // }

      return {
        _id: d.id,
        product: {
          ...d.product?.toJSON(),
          imagen: image,
          //variedades: variedadesProducto,
        },
        cantidad: d.cantidad,
        price_unitario: d.price_unitario,
        subtotal: d.subtotal,
        total: d.total,
        variedad: variedadObj,
        talla: tallaVal,
        type_discount: d.type_discount,
        discount: d.discount,
        code_cupon: d.code_cupon,
        code_discount: d.code_discount,
      };
    }));

    const shipmentJson = shipment.toJSON();
    shipmentJson.sale.items = items;

    return res.json({ success: true, shipment: shipmentJson });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};



// 🔹 Obtener todos los envíos de una venta
export const getBySale = async (req, res) => {
  try {
    const saleId = req.params.saleId;
    const shipments = await Shipment.findAll({ where: { saleId } });
    return res.json({ success: true, shipments });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 🔹 Actualizar un envío
export const update = async (req, res) => {
  try {
    const shipment = await Shipment.findByPk(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'No results' });

    await shipment.update(req.body);
    return res.json({ success: true, shipment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
