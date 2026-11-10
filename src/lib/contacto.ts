/** WhatsApp de Lu para contrataciones (formato internacional, sin + ni espacios). */
export const WHATSAPP_CONTRATACIONES = '59894912776'

const MENSAJE_CONTRATACION =
  '¡Hola Lu! 👋 Los vi en Música a la Carta y me encantaría contratarlos. ' +
  '¿Cuánto sale contratar a la banda y qué formatos tienen (dúo, trío, banda completa)? ¡Gracias!'

/** Link de WhatsApp con el mensaje de consulta ya escrito. */
export const CONTRATANOS_URL = `https://wa.me/${WHATSAPP_CONTRATACIONES}?text=${encodeURIComponent(
  MENSAJE_CONTRATACION,
)}`
