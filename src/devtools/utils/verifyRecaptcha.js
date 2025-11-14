import axios from 'axios';

export const verifyRecaptcha = async (token) => {
  try {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: token,
        },
      }
    );

    const { success, score } = response.data;
    return { success, score };
  } catch (error) {
    console.error('Error al verificar reCAPTCHA:', error.message);
    return { success: false, score: 0 };
  }
};
