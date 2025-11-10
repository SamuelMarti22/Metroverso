// Función para cargar los datos del dashboard
async function loadDashboardData() {
  try {
    const response = await fetch('/dashboard/');
    const data = await response.json();

    // Actualizar estaciones más usadas
    const stationsHtml = data.top_stations.map(station => `
      <div class="dashboard-item">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <div class="station-name">${station.name}</div>
            <small class="text-muted">Línea ${station.line} - ${station.type}</small>
          </div>
          <span class="badge">${station.usage} usos</span>
        </div>
      </div>
    `).join('') || '<p class="text-muted small">No hay datos disponibles</p>';

    document.getElementById('dashboard-stations').innerHTML = stationsHtml;
  } catch (error) {
    console.error('Error loading dashboard data:', error);
    document.getElementById('dashboard-stations').innerHTML = '<div class="alert alert-danger py-2 small">Error al cargar los datos</div>';
      if (el) {
        el.innerHTML = '<div class="alert alert-danger py-2 small">Error al cargar los datos</div>';
      }
    });
  }
}

// Cargar datos cuando se abre el offcanvas
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('offcanvasDashboard')?.addEventListener('show.bs.offcanvas', loadDashboardData);
});