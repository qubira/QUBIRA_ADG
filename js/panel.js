/* Un mismo panel para la Alta Dirección (ADG) y la Gerencia General (GG):
   las dos usan las mismas herramientas. La entrada decide cuál es:
   index.html → ADG · gg.html → GG (define window.QB_PANEL = 'GG').
   Así, lo que se agregue o corrija en un panel queda en los dos. */
export const PANEL = window.QB_PANEL === 'GG' ? 'GG' : 'ADG';
export const PANEL_NOMBRE = PANEL === 'GG' ? 'Gerencia General' : 'Alta Dirección Gerencial';
// Áreas con las herramientas de dirección (aprobar y administrar proyectos, costos, contratos)
export const AREAS_DIRECCION = ['ADG', 'GG'];
