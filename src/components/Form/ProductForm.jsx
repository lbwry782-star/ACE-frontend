import { useState } from 'react'
import ProgressBar from '../ProgressBar/ProgressBar'
import './form.css'

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
  onProgressComplete
}) {
  const [errors, setErrors] = useState({})

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    const newErrors = {}
    if (!formData.productName.trim()) {
      newErrors.productName = 'Product name is required'
    }
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

    onSubmit(formData)
  }

  const isDisabled = fieldsLocked || buttonDisabled

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="productName">Product Name *</label>
        <input
          type="text"
          id="productName"
          value={formData.productName}
          onChange={(e) => handleChange('productName', e.target.value)}
          disabled={isDisabled}
          placeholder="Enter product name"
        />
        {errors.productName && (
          <span className="error-message">{errors.productName}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="productDescription">Product Description *</label>
        <textarea
          id="productDescription"
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

      <div className="form-group">
        <label htmlFor="imageSize">Image Size *</label>
        <select
          id="imageSize"
          value={formData.imageSize}
          onChange={(e) => handleChange('imageSize', e.target.value)}
          disabled={isDisabled}
        >
          <option value="">Select image size</option>
          <option value="1024x1024">1024 × 1024 – Square</option>
          <option value="1536x1024">1536 × 1024 – Landscape</option>
          <option value="1024x1536">1024 × 1536 – Portrait</option>
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

