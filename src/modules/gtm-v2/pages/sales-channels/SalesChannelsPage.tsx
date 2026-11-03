import React, { useState } from 'react';
import {
  Share2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Power,
  History,
  AlertCircle
} from 'lucide-react';
import { useGtmV2 } from '../../context/GtmV2Context';
import type { SalesChannel } from '../../types/gtmV2.types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { SideDrawer } from '../../components/common/SideDrawer';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';

const COMMON_PAYMENT_MODES = [
  'NEFT / RTGS',
  'Cheque / PDC',
  'Letter of Credit',
  'Bank Guarantee',
  'Direct Debit',
  'UPI / QR',
  'Treasury Direct Transfer'
];

export const SalesChannelsPage: React.FC = () => {
  const { salesChannels, addSalesChannel, updateSalesChannel, deleteSalesChannel, toggleSalesChannelStatus } = useGtmV2();

  const [searchTerm, setSearchTerm] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<SalesChannel | null>(null);
  const [historyChannel, setHistoryChannel] = useState<SalesChannel | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDiscount, setFormDiscount] = useState(10.0);
  const [formCreditDays, setFormCreditDays] = useState(30);
  const [formCreditLimit, setFormCreditLimit] = useState(2500000);
  const [formRequiresDeposit, setFormRequiresDeposit] = useState(false);
  const [formDepositAmount, setFormDepositAmount] = useState(500000);
  const [formMinOrder, setFormMinOrder] = useState(50000);
  const [formMaxOrder, setFormMaxOrder] = useState(5000000);
  const [formPaymentModes, setFormPaymentModes] = useState<string[]>(['NEFT / RTGS']);
  const [formEffectiveFrom, setFormEffectiveFrom] = useState('');
  const [formEffectiveTo, setFormEffectiveTo] = useState('');
  const [formChangeReason, setFormChangeReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Target
  const [deleteTarget, setDeleteTarget] = useState<SalesChannel | null>(null);

  const filteredChannels = salesChannels.filter((ch) => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      ch.name.toLowerCase().includes(q) ||
      ch.code.toLowerCase().includes(q) ||
      ch.description.toLowerCase().includes(q)
    );
  });

  const handleOpenCreate = () => {
    setEditingChannel(null);
    setFormName('');
    setFormCode('');
    setFormDescription('');
    setFormDiscount(10.0);
    setFormCreditDays(30);
    setFormCreditLimit(2000000);
    setFormRequiresDeposit(false);
    setFormDepositAmount(0);
    setFormMinOrder(25000);
    setFormMaxOrder(10000000);
    setFormPaymentModes(['NEFT / RTGS', 'Cheque / PDC']);
    setFormEffectiveFrom(new Date().toISOString().substring(0, 10));
    setFormEffectiveTo('');
    setFormChangeReason('');
    setFormError(null);
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (ch: SalesChannel) => {
    setEditingChannel(ch);
    setFormName(ch.name);
    setFormCode(ch.code);
    setFormDescription(ch.description);
    setFormDiscount(ch.standardDiscountPercent);
    setFormCreditDays(ch.creditPeriodDays);
    setFormCreditLimit(ch.creditLimit);
    setFormRequiresDeposit(ch.requiresDeposit);
    setFormDepositAmount(ch.depositAmount);
    setFormMinOrder(ch.minOrderValue);
    setFormMaxOrder(ch.maxOrderValue);
    setFormPaymentModes(ch.allowedPaymentModes || ['NEFT / RTGS']);
    setFormEffectiveFrom(ch.effectiveFrom);
    setFormEffectiveTo(ch.effectiveTo || '');
    setFormChangeReason('');
    setFormError(null);
    setIsDrawerOpen(true);
  };

  const togglePaymentMode = (mode: string) => {
    setFormPaymentModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('Channel Name is required.');
      return;
    }
    if (!formCode.trim()) {
      setFormError('Channel Code is required.');
      return;
    }

    if (editingChannel) {
      updateSalesChannel(
        editingChannel.id,
        {
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          description: formDescription.trim(),
          standardDiscountPercent: Number(formDiscount),
          creditPeriodDays: Number(formCreditDays),
          creditLimit: Number(formCreditLimit),
          requiresDeposit: formRequiresDeposit,
          depositAmount: formRequiresDeposit ? Number(formDepositAmount) : 0,
          minOrderValue: Number(formMinOrder),
          maxOrderValue: Number(formMaxOrder),
          allowedPaymentModes: formPaymentModes,
          effectiveFrom: formEffectiveFrom,
          effectiveTo: formEffectiveTo || undefined
        },
        formChangeReason.trim() || 'Channel terms revised'
      );
    } else {
      addSalesChannel({
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        description: formDescription.trim(),
        status: 'Active',
        standardDiscountPercent: Number(formDiscount),
        creditPeriodDays: Number(formCreditDays),
        creditLimit: Number(formCreditLimit),
        requiresDeposit: formRequiresDeposit,
        depositAmount: formRequiresDeposit ? Number(formDepositAmount) : 0,
        minOrderValue: Number(formMinOrder),
        maxOrderValue: Number(formMaxOrder),
        allowedPaymentModes: formPaymentModes,
        effectiveFrom: formEffectiveFrom || new Date().toISOString().substring(0, 10),
        effectiveTo: formEffectiveTo || undefined
      });
    }

    setIsDrawerOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Share2 size={22} style={{ color: '#7C3AED' }} />
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Sales Channel Configuration
            </h2>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            Configure dynamic commercial tiers, margin baselines, credit windows, and statutory security terms.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#7C3AED',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(124, 58, 237, 0.2)'
          }}
        >
          <Plus size={16} />
          <span>Add Sales Channel</span>
        </button>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          padding: '14px 20px',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
        }}
      >
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94A3B8'
            }}
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search channels by name, code..."
            style={{
              width: '100%',
              height: '38px',
              paddingLeft: '36px',
              paddingRight: '12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              backgroundColor: '#F8FAFC',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <span style={{ fontSize: '13px', color: '#64748B' }}>
          <strong>{filteredChannels.length}</strong> Channels Configured
        </span>
      </div>

      {/* Channels Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: '20px'
        }}
      >
        {filteredChannels.map((channel) => (
          <div
            key={channel.id}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700, color: '#0F172A' }}>
                    {channel.name}
                  </h3>
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748B' }}>
                    {channel.code}
                  </span>
                </div>
                <StatusBadge status={channel.status} size="sm" />
              </div>

              <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: '#64748B', lineHeight: 1.45 }}>
                {channel.description}
              </p>

              {/* Commercial Terms Matrix Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  backgroundColor: '#F8FAFC',
                  padding: '14px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  marginBottom: '14px'
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Standard Discount</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#7C3AED' }}>
                    {channel.standardDiscountPercent}%
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Credit Period</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#1E293B' }}>
                    {channel.creditPeriodDays} Days
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Credit Limit Floor</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                    ₹{(channel.creditLimit / 100000).toFixed(1)} Lakh
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Security Deposit</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: channel.requiresDeposit ? '#B45309' : '#047857' }}>
                    {channel.requiresDeposit ? `₹${(channel.depositAmount / 100000).toFixed(1)} Lakh` : 'Not Required'}
                  </div>
                </div>
              </div>

              {/* Order Values & Payment Modes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#475569' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Order Threshold:</span>
                  <strong>
                    ₹{(channel.minOrderValue / 1000).toFixed(0)}k - ₹{(channel.maxOrderValue / 100000).toFixed(1)}L
                  </strong>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Allowed Payment Modes:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {(channel.allowedPaymentModes || []).map((pm) => (
                      <span
                        key={pm}
                        style={{
                          fontSize: '10.5px',
                          backgroundColor: '#F1F5F9',
                          color: '#334155',
                          borderRadius: '4px',
                          padding: '2px 6px'
                        }}
                      >
                        {pm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
              <button
                type="button"
                onClick={() => setHistoryChannel(channel)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                <History size={13} />
                <span>History ({channel.configHistory?.length || 0})</span>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => toggleSalesChannelStatus(channel.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: channel.status === 'Active' ? '#B91C1C' : '#047857',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <Power size={13} />
                  <span>{channel.status === 'Active' ? 'Deactivate' : 'Activate'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(channel)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #DDD6FE',
                    backgroundColor: '#F5F3FF',
                    color: '#7C3AED',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Edit2 size={13} />
                  <span>Configure</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTarget(channel)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid #FECACA',
                    backgroundColor: '#FEF2F2',
                    color: '#B91C1C',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE / EDIT CHANNEL DRAWER WITH CONDITIONAL FIELDS */}
      <SideDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingChannel ? `Configure Channel: ${editingChannel.name}` : 'Create Dynamic Sales Channel'}
        subtitle="Establish commercial terms, statutory margins, credit periods, and security requirements."
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="channel-form"
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#7C3AED',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {editingChannel ? 'Save Configuration' : 'Create Channel'}
            </button>
          </>
        }
      >
        <form id="channel-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#B91C1C',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Channel Name *
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Authorized Surgical Distributor"
                required
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Channel Code *
              </label>
              <input
                type="text"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                placeholder="e.g. DISTRIBUTOR"
                required
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Channel Description & Distribution Purpose
            </label>
            <textarea
              rows={2}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Describe commercial tier, purchasing model (PTD/PTR/MRP), and targeted healthcare clients..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '13px',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Commercial Grid */}
          <div
            style={{
              padding: '14px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Commercial Baselines
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Standard Discount (%) *
                </label>
                <input
                  type="number"
                  step={0.5}
                  value={formDiscount}
                  onChange={(e) => setFormDiscount(Number(e.target.value))}
                  required
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Credit Period (Days) *
                </label>
                <input
                  type="number"
                  value={formCreditDays}
                  onChange={(e) => setFormCreditDays(Number(e.target.value))}
                  required
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Credit Limit Floor (₹) *
                </label>
                <input
                  type="number"
                  step={100000}
                  value={formCreditLimit}
                  onChange={(e) => setFormCreditLimit(Number(e.target.value))}
                  required
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* CONDITIONAL FIELD: Security Deposit */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  id="deposit-req"
                  checked={formRequiresDeposit}
                  onChange={(e) => setFormRequiresDeposit(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="deposit-req" style={{ fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  Requires Security Deposit / Rolling Bank Guarantee
                </label>
              </div>

              {formRequiresDeposit && (
                <div style={{ width: '280px', marginTop: '6px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Mandatory Deposit Amount (₹)
                  </label>
                  <input
                    type="number"
                    step={100000}
                    value={formDepositAmount}
                    onChange={(e) => setFormDepositAmount(Number(e.target.value))}
                    required
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Min / Max Order Values */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Minimum Order Value (₹)
              </label>
              <input
                type="number"
                step={10000}
                value={formMinOrder}
                onChange={(e) => setFormMinOrder(Number(e.target.value))}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Maximum Order Value (₹)
              </label>
              <input
                type="number"
                step={500000}
                value={formMaxOrder}
                onChange={(e) => setFormMaxOrder(Number(e.target.value))}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Payment Modes Multiselect */}
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Allowed Payment Modes
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {COMMON_PAYMENT_MODES.map((mode) => {
                const isSelected = formPaymentModes.includes(mode);
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => togglePaymentMode(mode)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: `1px solid ${isSelected ? '#7C3AED' : '#CBD5E1'}`,
                      backgroundColor: isSelected ? '#F3E8FF' : '#FFFFFF',
                      color: isSelected ? '#7C3AED' : '#475569',
                      fontSize: '12px',
                      fontWeight: isSelected ? 600 : 400,
                      cursor: 'pointer'
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {mode}
                  </button>
                );
              })}
            </div>
          </div>

          {editingChannel && (
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Audit Change Justification (Logged into History)
              </label>
              <input
                type="text"
                value={formChangeReason}
                onChange={(e) => setFormChangeReason(e.target.value)}
                placeholder="Reason for modifying commercial margin or credit window..."
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}
        </form>
      </SideDrawer>

      {/* CONFIGURATION HISTORY SIDE DRAWER */}
      <SideDrawer
        isOpen={Boolean(historyChannel)}
        onClose={() => setHistoryChannel(null)}
        title={`Configuration Audit Log: ${historyChannel?.name}`}
        subtitle="Chronological trail of commercial modifications, DSO terms, and credit limits."
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {(historyChannel?.configHistory || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748B', fontSize: '13px' }}>
              No revisions logged for this channel.
            </div>
          ) : (
            (historyChannel?.configHistory || []).map((entry) => (
              <div
                key={entry.id}
                style={{
                  backgroundColor: '#F8FAFC',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748B' }}>
                  <span>{entry.timestamp}</span>
                  <span>Modified by: <strong>{entry.modifiedBy}</strong></span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>
                  {entry.changeSummary}
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                  <span>Discount: <strong>{entry.discountPercent}%</strong></span>
                  <span>Credit Days: <strong>{entry.creditPeriodDays}d</strong></span>
                  <span>Credit Limit: <strong>₹{(entry.creditLimit / 100000).toFixed(1)}L</strong></span>
                </div>
              </div>
            ))
          )}
        </div>
      </SideDrawer>

      {/* DELETE CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteSalesChannel(deleteTarget.id);
        }}
        title={`Delete Channel: ${deleteTarget?.name}?`}
        message={`Are you sure you want to permanently delete "${deleteTarget?.name}"? Ensure no active sales flows depend on this channel.`}
        confirmLabel="Delete Channel"
        variant="danger"
      />
    </div>
  );
};
