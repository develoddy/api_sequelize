import jwt from "jsonwebtoken";
import {User} from '../models/User.js';



export default {
    encode: async (id, rol, email) => {
        console.log("Debug - id in encode:", id); // Depuración
        const token = jwt.sign({ id, rol, email }, 'ecommerce_udemy', { expiresIn: '1d' });
        console.log("Debug - Token generated:", token);  // Depuración
        return token;
    },
    decode: async (token) => {
        try {
            // Verificar el token y obtener el payload
            const decoded = jwt.verify(token, 'ecommerce_udemy');
            console.log("Debug - Decoded token payload:", decoded);  // Depuración
            
            // Asegurarse de que el id esté presente en el payload
            const { id } = decoded;
            if (!id) {
                console.log("Debug - id is undefined in the token payload.");
                return false;
            }
            
            // Buscar el usuario con Sequelize
            const user = await User.findOne({
                where: {
                    id,
                    state: 1
                }
            });

            // Retornar el usuario si existe, sino false
            if (user) {
                return user;
            }
            return false;
        } catch (error) {
            console.log("Debug - token.js:", error);
            return false;
        }
    },
}