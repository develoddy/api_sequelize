import jwt from "jsonwebtoken";
import {User} from '../models/User.js';

const SECRET_KEY = process.env.JWT_SECRET || "ecommerce_udemy";

export default {
    encode: async (id, rol, email) => {
        //const token = jwt.sign({ id, rol, email }, SECRET_KEY, { expiresIn: '1d' });
        //return token;
        const accessToken = jwt.sign({ id, rol, email }, SECRET_KEY, { expiresIn: '1d' }); //1d /1h /6m
        const refreshToken = jwt.sign({ id, rol, email }, SECRET_KEY, { expiresIn: '30d' }); // 30d Más tiempo de vida
        return { accessToken, refreshToken };
    },
    decode: async (token) => {
        try {
            // Verificar el token y obtener el payload
            const decoded = jwt.verify(token, SECRET_KEY);
            
            // Asegurarse de que el id esté presente en el payload
            const { id } = decoded;

            if (!id) return false;
            
            // Verificar si el usuario sigue activo en la BD
            const user = await User.findOne({where: {id,state: 1}});

            if (!user) return false;

            return decoded; // Retornar el payload en lugar del usuario 
            //return user;
        } 
        catch (error) {
            if (error.name === "TokenExpiredError") {
                console.log("⚠️ Error: El token ha expirado.");
                return { error: "TokenExpired" }; // 🔹 Devuelve un estado especial
            } else if (error.name === "JsonWebTokenError") {
                console.log("❌ Error: Token inválido.");
                return false;
            } else {
                console.log("❌ Error desconocido:", error);
                return false;
            }
        } 
    },
}