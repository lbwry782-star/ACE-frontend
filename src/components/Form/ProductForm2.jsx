import { useState, useEffect } from 'react'
import ProgressBar from '../ProgressBar/ProgressBar'
import './form.css'

/** Builder2: same as ProductForm but without image/video size (fixed server-side). */
function ProductForm2({
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
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    onSubmit(formData)
  }

  const isDisabled = fieldsLocked || buttonDisabled
  const hasResolvedName = !!(isProductNameAuto && formData.productName?.trim())
  /* Single path: bold field-area block (disabled inputs rarely show bold reliably) */
  const showBoldResolvedFieldArea = hasResolvedName

  useEffect(() => {
    console.log('VIDEO_UI_PRODUCT_NAME_BOLD_RENDER=' + (showBoldResolvedFieldArea ? 'true' : 'false'))
  }, [showBoldResolvedFieldArea])

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="productName-b2">Product Name (leave blank and ACE will create one for you)</label>
        {showBoldResolvedFieldArea ? (
          <div
            id="productName-b2"
            className="product-form-name-resolved-display"
            aria-live="polite"
            aria-readonly="true"
          >
            {formData.productName}
          </div>
        ) : (
          <input
            type="text"
            id="productName-b2"
            value={formData.productName}
            onChange={(e) => handleChange('productName', e.target.value)}
            disabled={isDisabled}
            placeholder="Enter product name"
          />
        )}
        {errors.productName && (
          <span className="error-message">{errors.productName}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="productDescription-b2">Product Description *</label>
        <textarea
          id="productDescription-b2"
          value={formData.productDescription}
          onChange={(e) => handleChange('productDescription', e.target.value)}
          disabled={isDisabled}
          rows="6"
          placeholder="Enter detailed product description"
        />
        {errors.productDescription && (
          <span className="error-message">{errors.productDescription}</span>
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

export default ProductForm2
