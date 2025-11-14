import { Op, Sequelize } from 'sequelize';
import { ReturnRequest } from '../models/ReturnRequest.js';
import { Guest } from "../models/Guest.js";
import { Sale } from "../models/Sale.js";
import { User} from "../models/User.js";

// import { User } from "../models/User.js";

export const create = async (req, res) => {
  try {
    const payload = req.body;

    console.log('Payload de nueva devolución:', payload);

    // Validar que venga saleId
    if (!payload.saleId) {
      return res.status(400).json({ success: false, message: 'Falta el ID de la venta (saleId).' });
    }

    // Verificar que la venta exista
    const sale = await Sale.findByPk(payload.saleId);
    if (!sale) {
      return res.status(400).json({ success: false, message: `La venta con ID ${payload.saleId} no existe.` });
    }

    // 🟢 Si viene un email, buscar el userId correspondiente
    if (payload.userEmail) {
      const user = await User.findOne({ where: { email: payload.userEmail } });
      if (user) {
        payload.userId = user.id;
      } else {
        console.warn(`No se encontró usuario con email ${payload.userEmail}`);
      }
    }

    // 🟢 Si viene guestId (en caso de invitado)
    if (payload.guestId) {
      const guest = await Guest.findByPk(payload.guestId);
      if (guest) {
        payload.guestId = guest.id;
      }
    }

    // 🧠 Limpieza: eliminar campos que no existen en la tabla
    delete payload.userEmail;

    // Crear la solicitud de devolución si todo está correcto
    const rr = await ReturnRequest.create(payload);

    return res.json({ success: true, return: rr });

  } catch (err) { 
    console.error(err); 
    return res.status(500).json({ 
      success:false, 
      message: err.message 
    }); 
  }
};

export const getList = async (req, res) => {
  try {
    const { q, page=1, limit=20 } = req.query;
    const where = {};
    const include = [
      { model: Sale, as: 'sale' },
      { 
        model: User, 
        as: 'user',
        required: false // para que haga LEFT JOIN y no falle si no hay user
      }
    ];
    if (q) {
      // buscar por email en Sale->User o guestId o saleId
      // Buscar por email de usuario o guestId o saleId
      where[Op.or] = [
        { guestId: { [Op.like]: `%${q}%` } },
        { saleId: { [Op.like]: `%${q}%` } },
        { '$user.email$': { [Op.like]: `%${q}%` } }, // Buscar por email del usuario
      ];

      // Agregar filtro sobre user.email
      //include[1].where = { email: { [Op.like]: `%${q}%` } };
    }
    const { count, rows } = await ReturnRequest.findAndCountAll({
      where,
      include,
      limit: Number(limit),
      offset: (page - 1) * limit,
      order: [[ 'createdAt', 'DESC']]
    });
    return res.json({ success:true, total: count, returns: rows, page, pages: Math.ceil(count/limit) });
  } catch (err) { console.error(err); return res.status(500).json({ success:false, message: err.message }); }
};

export const getById = async (req, res) => {
  try {
    const id = req.params.id;
    const rr = await ReturnRequest.findByPk(id, { include: ['sale','user'] });
    if (!rr) return res.status(404).json({ success:false, message:'No results' });
    return res.json({ success:true, return: rr });
  } catch (err) { console.error(err); return res.status(500).json({ success:false, message: err.message }); }
};

export const update = async (req, res) => {
  try {
    const id = req.params.id;
    const rr = await ReturnRequest.findByPk(id);
    if (!rr) return res.status(404).json({ success:false, message:'No results' });
    await rr.update(req.body);
    return res.json({ success:true, return: rr });
  } catch (err) { console.error(err); return res.status(500).json({ success:false, message: err.message }); }
};

export const getBySale = async (req,res) => {
  try {
    const saleId = req.params.saleId;
    const rows = await ReturnRequest.findAll({ where: { saleId }});
    return res.json({ success:true, returns: rows });
  } catch (err) { console.error(err); return res.status(500).json({ success:false, message: err.message }); }
};

// GET /api/returns/has?q=emailOguestId
export const hasReturns = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, hasReturns: false });

    // Buscar devoluciones por guestId o saleId o email de usuario
    // const include = [
    //   { model: Sale, as: 'sale' },
    //   { model: User, as: 'user', required: false }
    // ];

    // const where = { [Op.or]: [
    //   { guestId: { [Op.like]: `%${q}%` } },
    //   { saleId: { [Op.like]: `%${q}%` } }
    // ]};

    const include = [
      { model: Sale, as: 'sale' },
      { 
        model: User, 
        as: 'user', 
        required: false, // LEFT JOIN
        where: q.includes('@') ? { email: { [Op.like]: `%${q}%` } } : undefined
      }
    ];

    const where = {
      [Op.or]: [
        { guestId: { [Op.like]: `%${q}%` } },
        { saleId: { [Op.like]: `%${q}%` } }
      ]
    };

    // Agregar filtro sobre user.email
    //include[1].where = { email: { [Op.like]: `%${q}%` } };

    const count = await ReturnRequest.count({ where, include, distinct: true  });

    return res.json({ success: true, hasReturns: count > 0 });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
