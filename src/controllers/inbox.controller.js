import { Op, Sequelize } from 'sequelize';
import { Inbox } from '../models/Inbox.js';

// 📬 Crear mensaje
export const create = async (req, res) => {
  try {
    const inbox = await Inbox.create(req.body);
    res.status(201).json(inbox);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📋 Listar todos los mensajes
export const getList = async (req, res) => {
  try {
    const inboxes = await Inbox.findAll({
      include: ['parent', 'replies', 'User', 'Guest'],
      order: [['createdAt', 'DESC']]
    });
    res.json(inboxes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔍 Obtener por ID
export const getById = async (req, res) => {
  try {
    const inbox = await Inbox.findByPk(req.params.id, {
      include: ['parent', 'replies', 'User', 'Guest']
    });
    if (!inbox) return res.status(404).json({ message: 'No encontrado' });
    res.json(inbox);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✏️ Actualizar mensaje (ej. marcar leído)
export const update = async (req, res) => {
  try {
    const inbox = await Inbox.findByPk(req.params.id);
    if (!inbox) return res.status(404).json({ message: 'No encontrado' });
    await inbox.update(req.body);
    res.json(inbox);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 📬 Obtener mensajes de un usuario
export const getByUser = async (req, res) => {
  try {
    const inboxes = await Inbox.findAll({ where: { userId: req.params.userId } });
    res.json(inboxes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
