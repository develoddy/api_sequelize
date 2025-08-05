import { Op } from 'sequelize';
import { Review } from "../models/Review.js";
import { User } from "../models/User.js";


export const register = async (req, res) => {
    try {
    	const { product, sale_detail, user, cantidad, title, description } = req.body;

        // Verifica si todos los campos necesarios están presentes
        if (!product || !sale_detail || !user) {
            return res.status(400).send({
                message: "Faltan campos obligatorios: product, sale_detail o user"
            });
        }

        const review = await Review.create({
            productId: product,
            saleDetailId: sale_detail,
            userId: user,
            cantidad,
            title,
            description
        });
        
        res.status(200).send({
            message: "Succes! La reseña ha sido registrada correctamente",
            review: review,
        });
    } catch (error) {
        res.status(500).send({
            message: "Ocurrió un problema al registrar la reseña"
        });
        console.log(error);
    }
}




export const update = async (req, res) => {
    try {

        const { _id, ...updateData } = req.body;

        // Busca y actualiza la reseña por ID
        const [updatedRows] = await Review.update(updateData, {
            where: { id: _id }
        });

        if (updatedRows === 0) {
            return res.status(404).send({
                message: "No se encontró la reseña con el ID proporcionado"
            });
        }

        // Obtén la reseña actualizada
        const reviewD = await Review.findByPk(_id, {
          include: [
            {
              model: User,
            }
          ]
        });

        res.status(200).send({
            message: "La reseña ha sido modificada correctamente",
            review: reviewD,
        });
    } catch (error) {
        res.status(500).send({
            message: "Ocurrió un problema al actualizar la reseña"
        });
        console.log(error);
    }
}
