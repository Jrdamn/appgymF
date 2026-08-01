const PDFDocument = require('pdfkit');

/**
 * Genera un PDF de recibo de compra en memoria.
 * @param {Object} sale - Datos de la venta
 * @returns {Promise<Buffer>} Buffer del PDF generado
 */
function generateSalePDF(sale) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ 
                size: 'A6', // Formato de ticket/recibo compacto y elegante
                margins: { top: 20, bottom: 20, left: 20, right: 20 }
            });
            
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // --- DISEÑO PREMIUM ---
            // Paleta de Colores Shark Gym (Gris Oscuro, Azul Eléctrico, Blanco)
            const colorPrimary = '#121212';
            const colorAccent = '#208AEF';
            const colorText = '#333333';

            // Cabecera / Logo
            doc.fillColor(colorAccent)
               .fontSize(18)
               .font('Helvetica-Bold')
               .text('SHARK GYM', { align: 'center' });
            
            doc.fillColor(colorText)
               .fontSize(8)
               .font('Helvetica-Oblique')
               .text('BE MORE SHARK - NO PAIN NO GAIN', { align: 'center' })
               .moveDown(1.5);

            // Título de Recibo
            doc.fillColor(colorPrimary)
               .fontSize(11)
               .font('Helvetica-Bold')
               .text(`RECIBO DE COMPRA #${sale.id || 'N/A'}`, { align: 'left' });
            
            // Línea divisoria
            doc.strokeColor(colorAccent)
               .lineWidth(1)
               .moveTo(20, doc.y)
               .lineTo(280, doc.y)
               .stroke()
               .moveDown(1);

            // Información de Facturación
            doc.fillColor(colorText)
               .fontSize(8)
               .font('Helvetica-Bold').text('Fecha: ', { continued: true })
               .font('Helvetica').text(sale.fecha ? new Date(sale.fecha).toLocaleString('es-ES') : new Date().toLocaleString('es-ES'))
               .font('Helvetica-Bold').text('Cliente: ', { continued: true })
               .font('Helvetica').text(sale.usuario_nombre || 'Cliente General')
               .font('Helvetica-Bold').text('Email: ', { continued: true })
               .font('Helvetica').text(sale.usuario_email || 'N/A')
               .font('Helvetica-Bold').text('Teléfono: ', { continued: true })
               .font('Helvetica').text(sale.usuario_telefono || 'N/A')
               .moveDown(1.5);

            // Detalle de la Compra
            doc.fillColor(colorPrimary)
               .fontSize(10)
               .font('Helvetica-Bold')
               .text('Detalle de Artículos');
            
            doc.strokeColor('#E0E0E0')
               .lineWidth(0.5)
               .moveTo(20, doc.y)
               .lineTo(280, doc.y)
               .stroke()
               .moveDown(0.5);

            // Calcular artículo comprado
            let itemDesc = 'Compra General';
            if (sale.tipo === 'producto') {
                itemDesc = sale.producto_nombre || 'Producto';
            } else if (sale.tipo === 'membresia') {
                itemDesc = `Membresía: ${sale.membresia_nombre || 'Plan'}`;
            }

            const qty = sale.cantidad || 1;
            const price = parseFloat(sale.total) / qty;
            const total = parseFloat(sale.total);

            // Fila de artículo
            doc.fillColor(colorText)
               .fontSize(9)
               .font('Helvetica-Bold').text(itemDesc, { align: 'left' })
               .font('Helvetica')
               .text(`${qty} x ₡${Math.round(price).toLocaleString('es-CR')}`, { indent: 10 })
               .moveDown(1);

            // Fila de Total
            doc.strokeColor(colorAccent)
               .lineWidth(1)
               .moveTo(20, doc.y)
               .lineTo(280, doc.y)
               .stroke()
               .moveDown(0.5);

            doc.fillColor(colorPrimary)
               .fontSize(11)
               .font('Helvetica-Bold')
               .text(`TOTAL PAGADO: ₡${Math.round(total).toLocaleString('es-CR')}`, { align: 'right' })
               .moveDown(2);

            // Mensaje de Cierre / QR Info
            doc.fillColor(colorAccent)
               .fontSize(8)
               .font('Helvetica-Bold')
               .text('¡Gracias por tu compra!', { align: 'center' })
               .fillColor(colorText)
               .fontSize(7)
               .font('Helvetica')
               .text('Presenta este recibo para cualquier aclaración.', { align: 'center' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Genera un PDF del Reporte Ejecutivo de Ventas y Stock para el Administrador.
 * @param {Object} data - Datos agregados del reporte (stats, products, memberships, sales)
 * @returns {Promise<Buffer>} Buffer del PDF de reporte generado
 */
function generateReportPDF(data) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ 
                size: 'A4', 
                margins: { top: 40, bottom: 40, left: 40, right: 40 }
            });
            
            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // Colores corporativos Shark Gym
            const colorPrimary = '#121212';
            const colorAccent = '#208AEF';
            const colorSecondary = '#4CAF50';
            const colorText = '#333333';

            // Cabecera / Logo
            doc.fillColor(colorAccent)
               .fontSize(22)
               .font('Helvetica-Bold')
               .text('SHARK GYM 🦈', { align: 'left' });
            
            doc.fillColor(colorText)
               .fontSize(10)
               .font('Helvetica-Oblique')
               .text('REPORTE GENERAL DE INGRESOS, INVENTARIO Y STOCK', { align: 'left' })
               .moveDown(1.5);

            // Información de Reporte
            doc.fillColor(colorText)
               .fontSize(9)
               .font('Helvetica-Bold').text('Fecha de Emisión: ', { continued: true })
               .font('Helvetica').text(new Date().toLocaleString('es-ES'))
               .font('Helvetica-Bold').text('Generado por: ', { continued: true })
               .font('Helvetica').text('Administrador General')
               .moveDown(1.5);

            // --- SECCIÓN 1: RESUMEN DE GASTOS / INGRESOS ---
            doc.fillColor(colorPrimary)
               .fontSize(14)
               .font('Helvetica-Bold')
               .text('1. Resumen Financiero y Gastos');
            
            doc.strokeColor(colorAccent)
               .lineWidth(1.5)
               .moveTo(40, doc.y)
               .lineTo(550, doc.y)
               .stroke()
               .moveDown(1);

            const { stats } = data;
            const totalGen = parseFloat(stats.total_general || 0);
            const totalProd = parseFloat(stats.total_productos || 0);
            const totalMemb = parseFloat(stats.total_membresias || 0);
            const salesCount = parseInt(stats.count || 0);
            const totalHoy = parseFloat(stats.total_hoy || 0);

            doc.fillColor(colorText)
               .fontSize(10)
               .font('Helvetica-Bold').text('Monto Recaudado Hoy (Ventas Hoy): ', { continued: true })
               .font('Helvetica').fillColor(colorSecondary).text(`₡${Math.round(totalHoy).toLocaleString('es-CR')}`)
               .fillColor(colorText)
               .font('Helvetica-Bold').text('Ventas Totales Registradas (Histórico): ', { continued: true })
               .font('Helvetica').text(`${salesCount} transacciones`)
               .font('Helvetica-Bold').text('Monto por Venta de Productos (Histórico): ', { continued: true })
               .font('Helvetica').text(`₡${Math.round(totalProd).toLocaleString('es-CR')}`)
               .font('Helvetica-Bold').text('Monto por Venta de Membresías (Histórico): ', { continued: true })
               .font('Helvetica').text(`₡${Math.round(totalMemb).toLocaleString('es-CR')}`)
               .font('Helvetica-Bold').text('TOTAL ACUMULADO GENERAL (Histórico): ', { continued: true })
               .font('Helvetica-Bold').fillColor(colorAccent).text(`₡${Math.round(totalGen).toLocaleString('es-CR')}`)
               .moveDown(2);

            // --- SECCIÓN 2: INVENTARIO DE PRODUCTOS (STOCK RESTANTE Y EN USO) ---
            doc.fillColor(colorPrimary)
               .fontSize(14)
               .font('Helvetica-Bold')
               .text('2. Inventario de Productos (Stock Restante y Vendido)');
            
            doc.strokeColor(colorAccent)
               .lineWidth(1.5)
               .moveTo(40, doc.y)
               .lineTo(550, doc.y)
               .stroke()
               .moveDown(1);

            // Cabecera Tabla
            let yTable = doc.y;
            doc.font('Helvetica-Bold').fontSize(9).fillColor(colorPrimary)
               .text('Producto', 40, yTable)
               .text('Stock Restante', 240, yTable, { width: 90, align: 'right' })
               .text('Stock Vendido (Uso)', 340, yTable, { width: 90, align: 'right' })
               .text('Total Recaudado', 440, yTable, { width: 100, align: 'right' });
            
            yTable += 15;
            doc.strokeColor('#CCCCCC').lineWidth(0.5).moveTo(40, yTable).lineTo(550, yTable).stroke();
            yTable += 8;

            doc.font('Helvetica').fontSize(9).fillColor(colorText);
            data.products.forEach(p => {
                doc.text(p.nombre, 40, yTable)
                   .text(p.stock_restante.toString(), 240, yTable, { width: 90, align: 'right' })
                   .text(p.stock_vendido.toString(), 340, yTable, { width: 90, align: 'right' })
                   .text(`$${parseFloat(p.total_recaudado || 0).toFixed(2)}`, 440, yTable, { width: 100, align: 'right' });
                yTable += 18;
            });

            doc.moveDown(2);

            // --- SECCIÓN 3: MEMBRESÍAS ADQUIRIDAS ---
            if (doc.y > 650 || yTable > 650) {
                doc.addPage();
            }

            doc.fillColor(colorPrimary)
               .fontSize(14)
               .font('Helvetica-Bold')
               .text('3. Ventas de Planes de Membresía');
            
            doc.strokeColor(colorAccent)
               .lineWidth(1.5)
               .moveTo(40, doc.y)
               .lineTo(550, doc.y)
               .stroke()
               .moveDown(1);

            let yMemb = doc.y;
            doc.font('Helvetica-Bold').fontSize(9).fillColor(colorPrimary)
               .text('Plan de Membresía', 40, yMemb)
               .text('Pases Vendidos', 300, yMemb, { width: 100, align: 'right' })
               .text('Total Recaudado', 440, yMemb, { width: 100, align: 'right' });
            
            yMemb += 15;
            doc.strokeColor('#CCCCCC').lineWidth(0.5).moveTo(40, yMemb).lineTo(550, yMemb).stroke();
            yMemb += 8;

            doc.font('Helvetica').fontSize(9).fillColor(colorText);
            data.memberships.forEach(m => {
                doc.text(m.nombre, 40, yMemb)
                   .text(m.cantidad_vendida.toString(), 300, yMemb, { width: 100, align: 'right' })
                   .text(`$${parseFloat(m.total_recaudado || 0).toFixed(2)}`, 440, yMemb, { width: 100, align: 'right' });
                yMemb += 18;
            });

            // --- SECCIÓN 4: ÚLTIMAS 15 TRANSACCIONES ---
            doc.addPage();
            
            doc.fillColor(colorPrimary)
               .fontSize(14)
               .font('Helvetica-Bold')
               .text('4. Registro de Transacciones Recientes (Últimas 15)');
            
            doc.strokeColor(colorAccent)
               .lineWidth(1.5)
               .moveTo(40, doc.y)
               .lineTo(550, doc.y)
               .stroke()
               .moveDown(1);

            let ySales = doc.y;
            doc.font('Helvetica-Bold').fontSize(8).fillColor(colorPrimary)
               .text('Fecha', 40, ySales)
               .text('Cliente', 130, ySales)
               .text('Tipo', 250, ySales)
               .text('Detalle', 320, ySales)
               .text('Cant.', 450, ySales, { width: 30, align: 'right' })
               .text('Total', 490, ySales, { width: 60, align: 'right' });
            
            ySales += 15;
            doc.strokeColor('#CCCCCC').lineWidth(0.5).moveTo(40, ySales).lineTo(550, ySales).stroke();
            ySales += 8;

            doc.font('Helvetica').fontSize(8).fillColor(colorText);
            data.sales.forEach(s => {
                const dateStr = s.fecha ? new Date(s.fecha).toLocaleDateString('es-ES') : 'N/A';
                const clientName = s.usuario_nombre || 'Cliente General';
                const conceptType = s.tipo === 'producto' ? 'Producto' : 'Membresía';
                const itemName = s.tipo === 'producto' ? (s.producto_nombre || 'Producto') : (s.membresia_nombre || 'Plan');
                
                doc.text(dateStr, 40, ySales)
                   .text(clientName, 130, ySales, { width: 110, ellipsis: true })
                   .text(conceptType, 250, ySales)
                   .text(itemName, 320, ySales, { width: 120, ellipsis: true })
                   .text(s.cantidad.toString(), 450, ySales, { width: 30, align: 'right' })
                   .text(`$${parseFloat(s.total).toFixed(2)}`, 490, ySales, { width: 60, align: 'right' });
                ySales += 18;
            });

            // Pie de página final
            doc.fillColor(colorAccent)
               .fontSize(9)
               .font('Helvetica-Bold')
               .text('FIN DEL REPORTE - SHARK GYM', 40, 750, { align: 'center' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = {
    generateSalePDF,
    generateReportPDF
};
