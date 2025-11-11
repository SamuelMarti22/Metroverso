// ==================== METROVERSO TUTORIAL WITH SHEPHERD.JS ====================

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  
  // Crear el tour
  const tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      classes: 'shepherd-theme-custom',
      scrollTo: { behavior: 'smooth', block: 'center' },
      cancelIcon: {
        enabled: true
      }
    }
  });

  // Paso 1: Bienvenida
  tour.addStep({
    id: 'welcome',
    text: `
      <h4 style="color: #20c997; margin-bottom: 16px;">👋 ¡Bienvenido a Metroverso!</h4>
      <p style="margin-bottom: 12px;">Tu guía inteligente para navegar por el Metro de Medellín.</p>
      <p style="color: #6c757d; font-size: 0.9rem;">Te mostraremos cómo usar todas las funciones en unos simples pasos.</p>
    `,
    buttons: [
      {
        text: '🚀 Comenzar',
        action: tour.next,
        classes: 'shepherd-button'
      },
      {
        text: 'Saltar tutorial',
        action: tour.cancel,
        classes: 'shepherd-button-secondary'
      }
    ]
  });

  // Paso 2: Planificador de rutas
  tour.addStep({
    id: 'route-planner',
    title: '🗺️ Planificador de Rutas',
    text: `
      <p>Aquí puedes <strong>planificar tu viaje</strong> entre dos estaciones.</p>
      <p style="margin-top: 8px; color: #6c757d; font-size: 0.9rem;">
        ✓ Busca rutas optimizadas<br>
        ✓ Consulta tiempo estimado<br>
        ✓ Visualiza transferencias
      </p>
    `,
    attachTo: {
      element: '.subCategory[data-bs-target="#offcanvasScrolling"]',
      on: 'right'
    },
    buttons: [
      { 
        text: '← Anterior', 
        action: tour.back,
        classes: 'shepherd-button-secondary'
      },
      { 
        text: 'Siguiente →', 
        action: tour.next,
        classes: 'shepherd-button'
      }
    ],
    when: {
      show: () => {
        // Asegurarse de que el offcanvas esté cerrado
        const offcanvas = document.querySelector('#offcanvasScrolling');
        if (offcanvas && offcanvas.classList.contains('show')) {
          const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvas);
          if (bsOffcanvas) bsOffcanvas.hide();
        }
      }
    }
  });

  // Paso 3: Líneas del metro
  tour.addStep({
    id: 'metro-lines',
    title: '🚇 Líneas del Metro',
    text: `
      <p>Explora todas las <strong>líneas del sistema</strong> y sus estaciones.</p>
      <p style="margin-top: 8px; color: #6c757d; font-size: 0.9rem;">
        ✓ Visualiza cada línea en el mapa<br>
        ✓ Consulta información de estaciones<br>
        ✓ Encuentra servicios disponibles
      </p>
    `,
    attachTo: {
      element: '.subCategory[data-bs-target="#offcanvasLines"]',
      on: 'right'
    },
    buttons: [
      { 
        text: '← Anterior', 
        action: tour.back,
        classes: 'shepherd-button-secondary'
      },
      { 
        text: 'Siguiente →', 
        action: tour.next,
        classes: 'shepherd-button'
      }
    ],
    when: {
      show: () => {
        const offcanvas = document.querySelector('#offcanvasLines');
        if (offcanvas && offcanvas.classList.contains('show')) {
          const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvas);
          if (bsOffcanvas) bsOffcanvas.hide();
        }
      }
    }
  });

  // Paso 4: Dashboard
  tour.addStep({
    id: 'dashboard',
    title: '📊 Dashboard Personal',
    text: `
      <p>Accede a tu <strong>panel de estadísticas</strong> y viajes.</p>
      <p style="margin-top: 8px; color: #6c757d; font-size: 0.9rem;">
        ✓ Ve tu historial de viajes<br>
        ✓ Consulta estadísticas<br>
        ✓ Revisa tus rutas favoritas
      </p>
    `,
    attachTo: {
      element: '.subCategory[data-bs-target="#offcanvasDashboard"]',
      on: 'right'
    },
    buttons: [
      { 
        text: '← Anterior', 
        action: tour.back,
        classes: 'shepherd-button-secondary'
      },
      { 
        text: 'Siguiente →', 
        action: tour.next,
        classes: 'shepherd-button'
      }
    ],
    when: {
      show: () => {
        const offcanvas = document.querySelector('#offcanvasDashboard');
        if (offcanvas && offcanvas.classList.contains('show')) {
          const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvas);
          if (bsOffcanvas) bsOffcanvas.hide();
        }
      }
    }
  });

  // Paso 4.5: Blog y Comunidad
  tour.addStep({
    id: 'blog',
    title: '📰 Blog y Comunidad',
    text: `
      <p>Visita el nuevo <strong>Blog</strong> para leer y publicar noticias y comentarios de la comunidad.</p>
      <p style="margin-top: 8px; color: #6c757d; font-size: 0.9rem;">
        ✓ Lee publicaciones de la comunidad<br>
        ✓ Publica comentarios y noticias
      </p>
      <p style="margin-top: 12px; color: #e67e22; font-size: 0.85rem;">
        💡 <em>Nota: debes iniciar sesión para poder publicar o comentar.</em>
      </p>
    `,
    attachTo: {
      element: '#btnBlog',
      on: 'right'
    },
    when: {
      show: () => {
        // Cerrar cualquier offcanvas abierto para que el paso pueda posicionarse correctamente
        const openOffcanvas = document.querySelectorAll('.offcanvas.show');
        openOffcanvas.forEach(el => {
          const inst = bootstrap.Offcanvas.getInstance(el);
          if (inst) inst.hide();
        });
      }
    },
    buttons: [
      { 
        text: '← Anterior', 
        action: tour.back,
        classes: 'shepherd-button-secondary'
      },
      { 
        text: 'Siguiente →', 
        action: tour.next,
        classes: 'shepherd-button'
      }
    ]
  });

  // Paso 5: Cambiar idioma
  tour.addStep({
    id: 'language',
    title: '🌍 Cambiar Idioma',
    text: `
      <p>Cambia el <strong>idioma de la aplicación</strong> entre español e inglés.</p>
      <p style="margin-top: 8px; color: #6c757d; font-size: 0.9rem;">
        La interfaz se adaptará automáticamente al idioma seleccionado.
      </p>
    `,
    attachTo: {
      element: '.subCategory[data-bs-target="#languageOffcanvas"]',
      on: 'right'
    },
    buttons: [
      { 
        text: '← Anterior', 
        action: tour.back,
        classes: 'shepherd-button-secondary'
      },
      { 
        text: 'Siguiente →', 
        action: tour.next,
        classes: 'shepherd-button'
      }
    ],
    when: {
      show: () => {
        const offcanvas = document.querySelector('#languageOffcanvas');
        if (offcanvas && offcanvas.classList.contains('show')) {
          const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvas);
          if (bsOffcanvas) bsOffcanvas.hide();
        }
      }
    }
  });

  // Paso 6: Tu ubicación
  tour.addStep({
    id: 'user-location',
    title: '📍 Tu Ubicación',
    text: `
      <p>Haz clic aquí para <strong>centrar el mapa en tu ubicación actual</strong>.</p>
      <p style="margin-top: 8px; color: #6c757d; font-size: 0.9rem;">
        ✓ Encuentra estaciones cercanas<br>
        ✓ Planifica desde donde estás<br>
        ✓ Navega en tiempo real
      </p>
    `,
    attachTo: {
      element: '.userLocation',
      on: 'left'
    },
    buttons: [
      { 
        text: '← Anterior', 
        action: tour.back,
        classes: 'shepherd-button-secondary'
      },
      { 
        text: 'Siguiente →', 
        action: tour.next,
        classes: 'shepherd-button'
      }
    ]
  });

  // Paso 7: Estaciones más cercanas
  tour.addStep({
    id: 'closest-stations',
    title: '🎯 Estaciones Cercanas',
    text: `
      <p>Cuando uses tu ubicación, aparecerá aquí un <strong>panel con las 3 estaciones más cercanas</strong> a ti.</p>
      <p style="margin-top: 8px; color: #6c757d; font-size: 0.9rem;">
        ✓ Selecciona una de las 3 estaciones<br>
        ✓ Se establecerá automáticamente como punto de partida<br>
        ✓ Ahorra tiempo en la planificación de rutas
      </p>
      <p style="margin-top: 12px; color: #e67e22; font-size: 0.85rem;">
        💡 <em>Nota: Este panel solo aparece después de activar tu ubicación.</em>
      </p>
    `,
    attachTo: {
      element: '#closestStationsBox',
      on: 'bottom'
    },
    buttons: [
      { 
        text: '← Anterior', 
        action: tour.back,
        classes: 'shepherd-button-secondary'
      },
      { 
        text: 'Siguiente →', 
        action: tour.next,
        classes: 'shepherd-button'
      }
    ]
  });

  // Paso 8: Seleccionar destino en el mapa
  tour.addStep({
    id: 'select-destination',
    title: '🎯 Seleccionar Destino',
    text: `
      <p>Usa este botón para <strong>seleccionar tu destino haciendo clic en el mapa</strong>.</p>
      <p style="margin-top: 8px; color: #6c757d; font-size: 0.9rem;">
        ✓ Activa el modo de selección<br>
        ✓ Haz clic en cualquier punto del mapa<br>
        ✓ Se seleccionará la estación más cercana
      </p>
    `,
    attachTo: {
      element: '.userLocation2',
      on: 'left'
    },
    buttons: [
      { 
        text: '← Anterior', 
        action: tour.back,
        classes: 'shepherd-button-secondary'
      },
      { 
        text: 'Siguiente →', 
        action: tour.next,
        classes: 'shepherd-button'
      }
    ]
  });

  // Paso 9: Interacción con el mapa
  tour.addStep({
    id: 'map-interaction',
    title: '🗺️ Interacción con el Mapa',
    text: `
      <p><strong>Explora el mapa libremente:</strong></p>
      <p style="margin-top: 12px; color: #2d3436; font-size: 0.95rem;">
        🖱️ <strong>Click</strong> en una estación para ver su información<br>
        📌 <strong>Arrastra</strong> para mover el mapa<br>
        🔍 <strong>Scroll</strong> para hacer zoom<br>
        🎯 <strong>Doble click</strong> para acercar rápidamente
      </p>
    `,
    attachTo: {
      element: '#map',
      on: 'top'
    },
    buttons: [
      { 
        text: '← Anterior', 
        action: tour.back,
        classes: 'shepherd-button-secondary'
      },
      { 
        text: '✓ Finalizar', 
        action: tour.complete,
        classes: 'shepherd-button'
      }
    ]
  });

  // Agregar indicador de progreso
  tour.on('show', (event) => {
    const currentStep = event.step;
    if (!currentStep) return;
    
    const currentStepElement = currentStep.getElement();
    if (!currentStepElement) return;
    
    const footer = currentStepElement.querySelector('.shepherd-footer');
    
    if (footer) {
      // Remover indicador anterior si existe
      const oldProgress = footer.querySelector('.shepherd-progress');
      if (oldProgress) oldProgress.remove();
      
      // Agregar nuevo indicador
      const progress = document.createElement('div');
      progress.className = 'shepherd-progress';
      const stepIndex = tour.steps.indexOf(currentStep);
      progress.textContent = `Paso ${stepIndex + 1} de ${tour.steps.length}`;
      footer.insertBefore(progress, footer.firstChild);
    }
  });

  // Guardar cuando complete el tutorial
  tour.on('complete', () => {
    localStorage.setItem('metroverso_tutorial_completed', 'true');
    
    // Crear alerta temporal específica para el tutorial
    const tutorialAlert = document.createElement('div');
    tutorialAlert.className = 'alert alert-success alert-dismissible fade show position-absolute top-0 start-50 translate-middle-x mt-3';
    tutorialAlert.style.cssText = 'z-index: 10000; max-width: 600px; box-shadow: 0 4px 12px rgba(32, 201, 151, 0.3);';
    tutorialAlert.innerHTML = `
      <strong>✅ ¡Tutorial completado!</strong> Ya conoces todas las funciones de Metroverso.
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.appendChild(tutorialAlert);
    
    // Auto-remover después de 4 segundos
    setTimeout(() => {
      tutorialAlert.classList.remove('show');
      setTimeout(() => {
        tutorialAlert.remove();
      }, 500);
    }, 4000);
  });

  // Guardar cuando cancele el tutorial
  tour.on('cancel', () => {
    localStorage.setItem('metroverso_tutorial_completed', 'true');
  });

  // Verificar si es la primera vez del usuario
  const hasSeenTutorial = localStorage.getItem('metroverso_tutorial_completed');
  
  if (!hasSeenTutorial) {
    // Esperar a que el mapa y todos los elementos estén cargados
    setTimeout(() => {
      tour.start();
    }, 1500);
  }

  // Función global para reiniciar el tutorial manualmente
  window.showTutorial = function() {
    tour.start();
  };

  // Crear botón flotante de ayuda
  createHelpButton();
});

// Función para crear el botón de ayuda flotante
function createHelpButton() {
  const helpButton = document.createElement('button');
  helpButton.className = 'tutorial-help-button';
  helpButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" class="bi bi-question-diamond-fill" viewBox="0 0 16 16"> <path d="M9.05.435c-.58-.58-1.52-.58-2.1 0L.436 6.95c-.58.58-.58 1.519 0 2.098l6.516 6.516c.58.58 1.519.58 2.098 0l6.516-6.516c.58-.58.58-1.519 0-2.098zM5.495 6.033a.237.237 0 0 1-.24-.247C5.35 4.091 6.737 3.5 8.005 3.5c1.396 0 2.672.73 2.672 2.24 0 1.08-.635 1.594-1.244 2.057-.737.559-1.01.768-1.01 1.486v.105a.25.25 0 0 1-.25.25h-.81a.25.25 0 0 1-.25-.246l-.004-.217c-.038-.927.495-1.498 1.168-1.987.59-.444.965-.736.965-1.371 0-.825-.628-1.168-1.314-1.168-.803 0-1.253.478-1.342 1.134-.018.137-.128.25-.266.25zm2.325 6.443c-.584 0-1.009-.394-1.009-.927 0-.552.425-.94 1.01-.94.609 0 1.028.388 1.028.94 0 .533-.42.927-1.029.927"/> </svg>';
  helpButton.title = 'Ver tutorial';
  helpButton.setAttribute('aria-label', 'Mostrar tutorial interactivo');
  helpButton.setAttribute('data-bs-toggle', 'tooltip');
  helpButton.setAttribute('data-bs-placement', 'right');
  
  helpButton.addEventListener('click', () => {
    if (typeof window.showTutorial === 'function') {
      window.showTutorial();
    }
  });
  
  document.body.appendChild(helpButton);
  
  // Inicializar el tooltip de Bootstrap
  new bootstrap.Tooltip(helpButton, {
    placement: 'right',
    trigger: 'hover',
    customClass: 'help-button-tooltip'
  });
}
