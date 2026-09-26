/* Taxonomía: especialidades, áreas, tipos de error y categorías.
 * Para añadir una especialidad (p. ej. Cardiología o Pediatría), agrégala
 * aquí y crea sus temas en content/temas/. */
SolMed.registry.defineTaxonomy({
  specialties: {
    'medicina-interna': {
      name: 'Medicina Interna',
      areas: {
        endocrinologia: { name: 'Endocrinología' },
        neurologia: { name: 'Neurología' },
      },
    },
    transversal: {
      name: 'Herramientas transversales',
      areas: {
        laboratorio: { name: 'Laboratorio' },
        calculos: { name: 'Cálculos' },
      },
    },
  },
  errorTypes: {
    conocimiento: { name: 'Conocimiento' },
    diferencial: { name: 'Diagnóstico diferencial' },
    laboratorio: { name: 'Interpretación de laboratorio' },
    calculo: { name: 'Cálculo' },
    razonamiento: { name: 'Razonamiento' },
    tratamiento: { name: 'Tratamiento' },
    secuencia: { name: 'Secuencia terapéutica' },
    complicaciones: { name: 'Complicaciones' },
  },
  categories: {
    concepto: { name: 'Conceptos' },
    fisiopatologia: { name: 'Fisiopatología' },
    diagnostico: { name: 'Diagnóstico' },
    diferencial: { name: 'Diagnóstico diferencial' },
    laboratorio: { name: 'Laboratorio' },
    calculo: { name: 'Cálculo' },
    tratamiento: { name: 'Tratamiento' },
    secuencia: { name: 'Secuencia terapéutica' },
    complicaciones: { name: 'Complicaciones' },
    integracion: { name: 'Integración clínica' },
    razonamiento: { name: 'Razonamiento' },
    valores: { name: 'Valores normales' },
  },
});
