import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import type { SalesOrder } from '@/types/sales-order';

// Define styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  orderNumber: {
    fontSize: 12,
    color: '#666',
  },
  qrCodeContainer: {
    width: 100,
    height: 100,
    marginLeft: 20,
  },
  qrCode: {
    width: 100,
    height: 100,
  },
  qrCodeLabel: {
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  column: {
    flex: 1,
  },
  label: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2,
  },
  value: {
    fontSize: 10,
    color: '#000',
  },
  table: {
    marginTop: 10,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    padding: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    padding: 8,
  },
  tableCell: {
    fontSize: 9,
  },
  itemCol: {
    flex: 3,
  },
  qtyCol: {
    flex: 1,
    textAlign: 'right',
  },
  unitCol: {
    flex: 1.2,
    textAlign: 'center',
  },
  priceCol: {
    flex: 1.5,
    textAlign: 'right',
  },
  discountCol: {
    flex: 1,
    textAlign: 'right',
  },
  taxCol: {
    flex: 1,
    textAlign: 'right',
  },
  totalCol: {
    flex: 1.5,
    textAlign: 'right',
  },
  totalsSection: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  totalsTable: {
    width: 250,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 5,
  },
  totalLabel: {
    fontSize: 10,
    color: '#666',
  },
  totalValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    backgroundColor: '#f5f5f5',
    marginTop: 5,
    borderTopWidth: 2,
    borderTopColor: '#000',
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 30,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  notes: {
    fontSize: 9,
    color: '#666',
    lineHeight: 1.4,
  },
  statusBadge: {
    position: 'absolute',
    top: 40,
    right: 40,
    padding: 8,
    backgroundColor: '#e3f2fd',
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1976d2',
  },
});

interface SalesOrderPDFProps {
  salesOrder: SalesOrder;
  currencySymbol: string;
  qrCodeDataUrl?: string;
}

export const SalesOrderPDF: React.FC<SalesOrderPDFProps> = ({ salesOrder, currencySymbol, qrCodeDataUrl }) => {
  const formatCurrency = (amount: number) => {
    // Handle peso symbol rendering issue in PDF
    const symbol = currencySymbol === '₱' ? 'PHP ' : currencySymbol;
    return `${symbol}${Math.abs(amount).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return { bg: '#e8f5e9', color: '#2e7d32' };
      case 'shipped':
        return { bg: '#f3e5f5', color: '#7b1fa2' };
      case 'in_progress':
        return { bg: '#fff3e0', color: '#f57c00' };
      case 'confirmed':
        return { bg: '#e3f2fd', color: '#1976d2' };
      case 'invoiced':
        return { bg: '#e8eaf6', color: '#5e35b1' };
      case 'cancelled':
        return { bg: '#ffebee', color: '#c62828' };
      default:
        return { bg: '#f5f5f5', color: '#616161' };
    }
  };

  const statusColors = getStatusColor(salesOrder.status);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
          <Text style={[styles.statusText, { color: statusColors.color }]}>
            {salesOrder.status.toUpperCase().replace('_', ' ')}
          </Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>SALES ORDER</Text>
            <Text style={styles.orderNumber}>Order #{salesOrder.orderNumber}</Text>
          </View>
          {qrCodeDataUrl && (
            <View style={styles.qrCodeContainer}>
              <Image style={styles.qrCode} src={qrCodeDataUrl} alt="" />
              <Text style={styles.qrCodeLabel}>Scan for details</Text>
            </View>
          )}
        </View>

        {/* Order Details and Customer Info */}
        <View style={styles.row}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Customer:</Text>
            <Text style={styles.value}>{salesOrder.customerName}</Text>
            <Text style={[styles.value, { fontSize: 9, color: '#666' }]}>{salesOrder.customerEmail}</Text>
            {salesOrder.shippingAddress && (
              <>
                <Text style={[styles.value, { fontSize: 9, marginTop: 5 }]}>{salesOrder.shippingAddress}</Text>
                {salesOrder.shippingCity && (
                  <Text style={[styles.value, { fontSize: 9 }]}>
                    {salesOrder.shippingCity}, {salesOrder.shippingState} {salesOrder.shippingPostalCode}
                  </Text>
                )}
                {salesOrder.shippingCountry && (
                  <Text style={[styles.value, { fontSize: 9 }]}>{salesOrder.shippingCountry}</Text>
                )}
              </>
            )}
          </View>

          <View style={styles.column}>
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.label}>Order Date:</Text>
              <Text style={styles.value}>{formatDate(salesOrder.orderDate)}</Text>
            </View>
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.label}>Expected Delivery:</Text>
              <Text style={styles.value}>{formatDate(salesOrder.expectedDeliveryDate)}</Text>
            </View>
            {salesOrder.quotationNumber && (
              <View>
                <Text style={styles.label}>Quotation:</Text>
                <Text style={styles.value}>{salesOrder.quotationNumber}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.itemCol]}>Item</Text>
            <Text style={[styles.tableCell, styles.qtyCol]}>Qty</Text>
            <Text style={[styles.tableCell, styles.unitCol]}>Unit</Text>
            <Text style={[styles.tableCell, styles.priceCol]}>Price</Text>
            <Text style={[styles.tableCell, styles.discountCol]}>Disc%</Text>
            <Text style={[styles.tableCell, styles.taxCol]}>Tax%</Text>
            <Text style={[styles.tableCell, styles.totalCol]}>Total</Text>
          </View>

          {salesOrder.lineItems.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <View style={styles.itemCol}>
                <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>{item.itemName}</Text>
                <Text style={[styles.tableCell, { fontSize: 8, color: '#666' }]}>{item.itemCode}</Text>
                {item.description && (
                  <Text style={[styles.tableCell, { fontSize: 8, color: '#666', marginTop: 2 }]}>
                    {item.description}
                  </Text>
                )}
              </View>
              <Text style={[styles.tableCell, styles.qtyCol]}>{item.quantity}</Text>
              <Text style={[styles.tableCell, styles.unitCol]}>
                {item.packaging?.name || '-'}
              </Text>
              <Text style={[styles.tableCell, styles.priceCol]}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={[styles.tableCell, styles.discountCol]}>{item.discount}%</Text>
              <Text style={[styles.tableCell, styles.taxCol]}>{item.taxRate}%</Text>
              <Text style={[styles.tableCell, styles.totalCol]}>{formatCurrency(item.lineTotal)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsTable}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>{formatCurrency(salesOrder.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount:</Text>
              <Text style={[styles.totalValue, { color: '#c62828' }]}>
                {formatCurrency(salesOrder.totalDiscount)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax:</Text>
              <Text style={styles.totalValue}>{formatCurrency(salesOrder.totalTax)}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total Amount:</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(salesOrder.totalAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Footer Notes */}
        {(salesOrder.paymentTerms || salesOrder.notes) && (
          <View style={styles.footer}>
            {salesOrder.paymentTerms && (
              <View style={{ marginBottom: 10 }}>
                <Text style={[styles.sectionTitle, { fontSize: 10 }]}>Payment Terms:</Text>
                <Text style={styles.notes}>{salesOrder.paymentTerms}</Text>
              </View>
            )}
            {salesOrder.notes && (
              <View>
                <Text style={[styles.sectionTitle, { fontSize: 10 }]}>Notes:</Text>
                <Text style={styles.notes}>{salesOrder.notes}</Text>
              </View>
            )}
          </View>
        )}
      </Page>
    </Document>
  );
};
