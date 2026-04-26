import { useState, useMemo } from 'react'
import ProgressBar from '../ProgressBar/ProgressBar'
import { getAgentDisplayName } from '../../utils/agentDisplayName'
import './form.css'

/** First strong letter: Hebrew → rtl, Latin → ltr; empty or only weak chars → null (neutral). */
function detectFieldTextDirection(text) {
  const s = String(text ?? '')
  if (!s.trim()) return null
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c >= 0x0590 && c <= 0x05ff) return 'rtl'
    if (c >= 0xfb1d && c <= 0xfb4f) return 'rtl'
    if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) return 'ltr'
  }
  return null
}

function ProductForm({
  formData,
  setFormData,
  onSubmit,
  fieldsLocked,
  buttonText,
  buttonDisabled,
  showProgress,
  progressActive,
  progressKey,
  onProgressComplete,
  isProductNameAuto,
  onProductNameEdited
}) {
  const [errors, setErrors] = useState({})

  const nameDir = useMemo(() => detectFieldTextDirection(formData.productName), [formData.productName])
  const descriptionDir = useMemo(() => detectFieldTextDirection(formData.productDescription), [formData.productDescription])

  const handleChange = (field, value) => {
    if (field === 'productName') {
      console.log('PRODUCT_NAME_SET_SOURCE=user_input value="' + String(value).replace(/"/g, '\\"') + '"')
      if (onProductNameEdited) onProductNameEdited()
    }
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const newErrors = {}
    if (!formData.productDescription.trim()) {
      newErrors.productDescription = 'Product description is required'
    }
    if (!formData.imageSize) {
      newErrors.imageSize = 'Image size is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    onSubmit(formData)
  }

  const isDisabled = fieldsLocked || buttonDisabled

  const nameInputStyle = {
    ...(isProductNameAuto
      ? {
          fontWeight: '700',
          letterSpacing: '0.02em',
          color: '#ffffff'
        }
      : {}),
    ...(nameDir === 'rtl' ? { textAlign: 'right' } : nameDir === 'ltr' ? { textAlign: 'left' } : {})
  }

  const descriptionInputStyle = {
    ...(descriptionDir === 'rtl' ? { textAlign: 'right' } : descriptionDir === 'ltr' ? { textAlign: 'left' } : {})
  }

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="productName" className="product-form1-bilingual-label">
          <span className="product-form1-label-en">
            Product Name (leave blank and {getAgentDisplayName('en')} will create one for you)
          </span>
          <span className="product-form1-label-he" dir="rtl">
            שם המוצר (אפשר להשאיר ריק ו-{getAgentDisplayName('he')} ייצור שם עבורך)
          </span>
        </label>
        <input
          type="text"
          id="productName"
          className="ace-product-text-input"
          value={formData.productName}
          onChange={(e) => handleChange('productName', e.target.value)}
          disabled={isDisabled}
          placeholder="Enter product name"
          dir={nameDir || undefined}
          style={nameInputStyle}
        />
        {errors.productName && (
          <span className="error-message">{errors.productName}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="productDescription" className="product-form1-bilingual-label">
          <span className="product-form1-label-en">Product Description *</span>
          <span className="product-form1-label-he" dir="rtl">תיאור המוצר *</span>
        </label>
        <textarea
          id="productDescription"
          className="ace-product-text-input"
          value={formData.productDescription}
          onChange={(e) => handleChange('productDescription', e.target.value)}
          disabled={isDisabled}
          rows="6"
          placeholder="Enter detailed product description"
          dir={descriptionDir || undefined}
          style={descriptionInputStyle}
        />
        {errors.productDescription && (
          <span className="error-message">{errors.productDescription}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="imageSize" className="product-form1-bilingual-label">
          <span className="product-form1-label-en">Size *</span>
          <span className="product-form1-label-he" dir="rtl">גודל *</span>
        </label>
        <select
          id="imageSize"
          value={formData.imageSize}
          onChange={(e) => handleChange('imageSize', e.target.value)}
          disabled={isDisabled}
        >
          <option value="">Select / בחר</option>
          <option value="portrait">אורכי / Portrait / 1080×1536</option>
          <option value="landscape">רוחבי / Landscape / 1536×1080</option>
          <option value="square">ריבועי / Square / 1080×1080</option>
        </select>
        {errors.imageSize && (
          <span className="error-message">{errors.imageSize}</span>
        )}
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="submit-button"
          disabled={buttonDisabled}
        >
          {buttonText}
        </button>
        {showProgress && (
          <ProgressBar
            key={progressKey}
            isActive={progressActive}
            onComplete={onProgressComplete}
          />
        )}
      </div>
    </form>
  )
}

export default ProductForm
