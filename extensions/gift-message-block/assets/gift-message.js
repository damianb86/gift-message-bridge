(function () {
  "use strict";

  if (window.__GiftMessageBridgeLiteLoaded) return;
  window.__GiftMessageBridgeLiteLoaded = true;

  var WARN_THRESHOLD = 20;
  var PROXY_PATH = "/apps/gift-message";
  var MESSAGE_PROPERTY = "Gift Message";
  var MESSAGE_FROM_PROPERTY = "Gift Message From";
  var MESSAGE_TO_PROPERTY = "Gift Message To";
  var MESSAGE_REFERENCE_PROPERTY = "Gift Message Ref";
  var CARD_PRODUCT_SOURCE_PROPERTY = "_Gift Message Card";
  var CARD_PRODUCT_SELECTION_PROPERTY = "_Gift Message Card Selection";
  var CARD_PRODUCT_VARIANT_ID_PROPERTY = "_Gift Message Card Variant";
  var REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  var REFERENCE_LENGTH = 5;
  var CARD_PRODUCTS_INTENT = "card-products";
  var cardProductsRequest = null;
  var pendingProductAdd = null;
  var cartAddInterceptorInstalled = false;
  var drawerEmbedCounter = 0;
  var drawerSyncTimer = null;
  var globalToggleFallbackInstalled = false;
  var mutationObserverInstalled = false;
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;

  function initBlock(block) {
    if (block.dataset.gmbInitialized === "true") return;
    block.dataset.gmbInitialized = "true";

    var toggle = block.querySelector(".gmb-check");
    var field = block.querySelector(".gmb-panel");
    var textarea = block.querySelector(".gmb-message");
    var senderInput = block.querySelector(".gmb-from");
    var recipientInput = block.querySelector(".gmb-to");
    var messageIdInput = block.querySelector(".gmb-message-id");
    var remaining = block.querySelector(".gmb-count-left");
    var saving = block.querySelector(".gmb-status");
    var saveButton = block.querySelector(".gmb-save-button");
    var savedSummary = block.querySelector("[data-gmb-saved-summary]");
    var editButton = block.querySelector(".gmb-edit-button");
    var cardProductPicker = block.querySelector("[data-gmb-card-products]");
    var removeButtons = block.querySelectorAll(
      ".gmb-remove-button, .gmb-summary-remove-button",
    );

    if (!toggle || !field || !textarea) {
      return;
    }

    var mode = block.dataset.mode;
    var cartToken = block.dataset.cartToken || "";
    var manualSave = block.dataset.manualSave === "true";
    var hasSavedMessage = block.dataset.hasSavedMessage === "true";
    var isDirty = false;
    var textFormEnabled = block.dataset.textFormEnabled !== "false";
    var lineItemPropertiesEnabled =
      block.dataset.lineItemProperties !== "false";
    var cardVariantChoicesEnabled =
      block.dataset.cardVariantChoices !== "false";
    var cardVariantStyle = normalizeCardVariantStyle(
      block.dataset.cardVariantStyle,
    );
    var cardVariantLabel =
      cleanString(block.dataset.cardVariantLabel) || "Choose a message card";
    var moneyCurrencyCode = getCurrencyCode(block.dataset.moneyCurrencyCode);
    var productId = block.dataset.productId || "";
    var productTitle = block.dataset.productTitle || "";
    var productHandle = block.dataset.productHandle || "";
    var productVariants = getProductVariants();
    var cardProductConfig = null;
    var cardVariantOptions = [];
    var selectedCardVariant = null;
    var maxLen = parseInt(textarea.getAttribute("maxlength"), 10) || 250;
    var lastProductCheckoutIntentAt = 0;
    var cartReference = "";

    // ── Character counter ────────────────────────────────────────────────
    function updateCounter() {
      if (!remaining) return;
      var left = maxLen - textarea.value.length;
      remaining.textContent = left;
      if (left <= WARN_THRESHOLD) {
        remaining.setAttribute("data-warn", "");
      } else {
        remaining.removeAttribute("data-warn");
      }
    }

    textarea.addEventListener("input", updateCounter);
    updateCounter();

    // ── Toggle ───────────────────────────────────────────────────────────
    function setPanelOpen(open) {
      syncPanelOpenState(block, toggle, field, open);
      setCardProductPickerDisabled(!open);

      if (mode === "product") {
        textarea.disabled = !open || !textFormEnabled;
        if (senderInput) senderInput.disabled = !open;
        if (recipientInput) recipientInput.disabled = !open;
        if (messageIdInput) messageIdInput.disabled = !open;
      }
    }

    function handleToggleChange() {
      var checked = toggle.checked;
      setPanelOpen(checked);

      if (manualSave) {
        if (checked && textFormEnabled) {
          textarea.focus();
        }
        updateManualUi();
        return;
      }

      if (mode === "product") {
        if (!checked) {
          textarea.value = "";
          if (senderInput) senderInput.value = "";
          if (recipientInput) recipientInput.value = "";
        }
      }

      if (mode === "order" && !checked) {
        saveOrderMessage("", "", "", null);
        textarea.value = "";
        if (senderInput) senderInput.value = "";
        if (recipientInput) recipientInput.value = "";
      }

      if (mode === "order" && checked && textFormEnabled) {
        textarea.focus();
      }

      if (mode === "product") {
        syncProductProperties();
      }
    }

    toggle.addEventListener("change", handleToggleChange);
    toggle.addEventListener("input", handleToggleChange);
    toggle.addEventListener("click", function () {
      window.setTimeout(handleToggleChange, 0);
    });
    setPanelOpen(toggle.checked);

    if (mode === "product" && !toggle.checked) {
      textarea.disabled = true;
      if (senderInput) senderInput.disabled = true;
      if (recipientInput) recipientInput.disabled = true;
      if (messageIdInput) messageIdInput.disabled = true;
    } else if (mode === "product" && !textFormEnabled) {
      textarea.disabled = true;
    }

    if (cardVariantChoicesEnabled && cardProductPicker) {
      loadCardProductConfig(function (variants) {
        renderCardVariantPicker(variants);
        if (manualSave) updateManualUi();
      });
    }

    if (mode === "product") {
      installCartAddInterceptor();
      loadCartToken(syncProductPropertiesFromCurrentForm);
      if (textFormEnabled) {
        textarea.addEventListener("focus", loadCartToken);
      }
      if (!manualSave && textFormEnabled) {
        textarea.addEventListener(
          "input",
          syncProductPropertiesFromCurrentForm,
        );
        if (senderInput)
          senderInput.addEventListener(
            "input",
            syncProductPropertiesFromCurrentForm,
          );
        if (recipientInput)
          recipientInput.addEventListener(
            "input",
            syncProductPropertiesFromCurrentForm,
          );
      }
      syncProductProperties();
      document.addEventListener("submit", handleProductSubmit, true);
      document.addEventListener("pointerdown", handleProductAddIntent, true);
      document.addEventListener("touchstart", handleProductAddIntent, true);
      document.addEventListener("click", handleProductAddIntent, true);
      document.addEventListener(
        "pointerdown",
        handleProductCheckoutIntent,
        true,
      );
      document.addEventListener(
        "touchstart",
        handleProductCheckoutIntent,
        true,
      );
      document.addEventListener("click", handleProductCheckoutIntent, true);
    }

    if (manualSave) {
      if (textFormEnabled) textarea.addEventListener("input", markDirty);
      if (senderInput) senderInput.addEventListener("input", markDirty);
      if (recipientInput) recipientInput.addEventListener("input", markDirty);
      if (saveButton) {
        saveButton.addEventListener("click", saveCurrentMessage);
      }
      if (editButton) {
        editButton.addEventListener("click", function () {
          toggle.checked = true;
          setPanelOpen(true);
          if (textFormEnabled) textarea.focus();
          updateManualUi();
        });
      }
      removeButtons.forEach(function (button) {
        button.addEventListener("click", removeSavedMessage);
      });
      updateManualUi();
    }

    // ── Order mode: save through the App Proxy ───────────────────────────
    if (mode === "order" && !manualSave) {
      var saveTimer = null;

      var scheduleSave = function () {
        clearTimeout(saveTimer);
        setSaving("Saving…");
        saveTimer = setTimeout(function () {
          saveOrderMessage(
            getMessageValue(),
            getSenderValue(),
            getRecipientValue(),
            function () {
              setSaving("Saved ✓");
              setTimeout(function () {
                setSaving("");
              }, 2000);
            },
          );
        }, 600);
      };

      textarea.addEventListener("input", scheduleSave);
      if (senderInput) senderInput.addEventListener("input", scheduleSave);
      if (recipientInput)
        recipientInput.addEventListener("input", scheduleSave);

      textarea.addEventListener("blur", function () {
        clearTimeout(saveTimer);
        saveOrderMessage(
          getMessageValue(),
          getSenderValue(),
          getRecipientValue(),
          function () {
            setSaving("");
          },
        );
      });
      if (senderInput)
        senderInput.addEventListener("blur", function () {
          clearTimeout(saveTimer);
          saveOrderMessage(
            getMessageValue(),
            getSenderValue(),
            getRecipientValue(),
            function () {
              setSaving("");
            },
          );
        });
      if (recipientInput)
        recipientInput.addEventListener("blur", function () {
          clearTimeout(saveTimer);
          saveOrderMessage(
            getMessageValue(),
            getSenderValue(),
            getRecipientValue(),
            function () {
              setSaving("");
            },
          );
        });
    }

    function setSaving(text) {
      if (saving) saving.textContent = text;
    }

    function markDirty() {
      if (!manualSave) return;

      isDirty = true;
      hasSavedMessage = false;
      block.dataset.hasSavedMessage = "false";
      setSaving(hasAnyContent() ? "Unsaved" : "");

      if (mode === "product") {
        removeProductProperties(findProductForm());
      }

      updateManualUi();
    }

    function saveCurrentMessage() {
      if (!manualSave) return;

      var value = getMessageValue();
      var sender = getSenderValue();
      var recipient = getRecipientValue();
      var hasTextContent = hasGiftMessageTextContent(sender, recipient, value);

      if (!hasAnyContent()) {
        removeSavedMessage();
        return;
      }

      setManualButtonsBusy(true);
      setSaving("Saving...");

      if (mode === "product") {
        hasSavedMessage = true;
        isDirty = false;
        block.dataset.hasSavedMessage = "true";
        syncProductProperties();
        if (!hasTextContent) {
          finishManualSave();
          return;
        }
        persistProductMessage(
          function () {
            finishManualSave();
          },
          function () {
            hasSavedMessage = false;
            isDirty = true;
            block.dataset.hasSavedMessage = "false";
            removeProductProperties(findProductForm());
            failManualSave();
          },
        );
        return;
      }

      loadCartToken(function () {
        var finishOrderSave = function () {
          addSelectedCardProductToCart(
            function () {
              finishManualSave();
            },
            function () {
              failManualSave();
            },
          );
        };

        if (textFormEnabled || hasTextContent) {
          saveOrderMessage(
            value,
            sender,
            recipient,
            finishOrderSave,
            function () {
              failManualSave();
            },
          );
          return;
        }

        finishOrderSave();
      });
    }

    function finishManualSave() {
      hasSavedMessage = true;
      isDirty = false;
      block.dataset.hasSavedMessage = "true";
      setSaving("Saved");
      setManualButtonsBusy(false);
      toggle.checked = false;
      setPanelOpen(false);
      updateManualUi();
      setTimeout(function () {
        if (!isDirty) setSaving("");
      }, 1800);
    }

    function failManualSave() {
      setManualButtonsBusy(false);
      setSaving("Could not save. Try again.");
      updateManualUi();
    }

    function removeSavedMessage() {
      if (!manualSave) return;

      setManualButtonsBusy(true);
      setSaving("Removing...");

      var currentMessageId = messageIdInput ? messageIdInput.value : "";
      textarea.value = "";
      if (senderInput) senderInput.value = "";
      if (recipientInput) recipientInput.value = "";
      updateCounter();

      if (mode === "product") {
        removeProductProperties(findProductForm());
        if (currentMessageId) {
          persistMessage(
            "",
            "",
            "",
            {
              cartToken: cartToken,
              cartReference: ensureCartReference(),
              messageId: currentMessageId,
              mode: "product",
              productId: productId,
              productTitle: productTitle,
              productHandle: productHandle,
              keepalive: true,
            },
            function () {
              finishRemoveSavedMessage();
            },
            function () {
              failManualSave();
            },
          );
        } else {
          finishRemoveSavedMessage();
        }
        return;
      }

      loadCartToken(function () {
        saveOrderMessage(
          "",
          "",
          "",
          function () {
            finishRemoveSavedMessage();
          },
          function () {
            failManualSave();
          },
        );
      });
    }

    function finishRemoveSavedMessage() {
      if (messageIdInput) messageIdInput.value = "";
      hasSavedMessage = false;
      isDirty = false;
      block.dataset.hasSavedMessage = "false";
      setSaving("Removed");
      setManualButtonsBusy(false);
      toggle.checked = false;
      setPanelOpen(false);
      updateManualUi();
      setTimeout(function () {
        if (!isDirty && !hasSavedMessage) setSaving("");
      }, 1600);
    }

    function updateManualUi() {
      if (!manualSave) return;

      var hasContent = hasAnyContent();
      var showSavedSummary = hasSavedMessage && !isDirty && !toggle.checked;

      if (savedSummary) savedSummary.hidden = !showSavedSummary;

      removeButtons.forEach(function (button) {
        button.hidden = !(hasSavedMessage || hasContent);
      });

      if (saveButton) {
        saveButton.disabled = !hasContent || (hasSavedMessage && !isDirty);
      }
    }

    function setManualButtonsBusy(busy) {
      if (saveButton) saveButton.disabled = busy;
      removeButtons.forEach(function (button) {
        button.disabled = busy;
      });
    }

    function hasAnyContent() {
      return Boolean(
        hasGiftMessageTextContent(
          getSenderValue(),
          getRecipientValue(),
          getMessageValue(),
        ) || hasSelectedCardProduct(),
      );
    }

    /**
     * Send the message to the App Proxy (/apps/gift-message).
     * Shopify proxies the request to the app backend, which verifies the HMAC,
     * persists the message in the DB, and returns { ok: true }.
     *
     * After the proxy confirms the save we also call /cart/update.js so the
     * cart attribute is updated for immediate display in the storefront.
     */
    function saveOrderMessage(value, sender, recipient, onSuccess, onError) {
      if (!cartToken) {
        // Fallback: update the cart attribute directly if we have no token.
        updateCartAttributes(value, sender, recipient, onSuccess, onError);
        return;
      }

      persistMessage(
        value,
        sender,
        recipient,
        {
          cartToken: cartToken,
          cartReference: ensureCartReference(),
          mode: mode,
        },
        function () {
          // Keep the Shopify cart attribute in sync for native cart display.
          updateCartAttributes(value, sender, recipient, onSuccess, onError);
        },
        function (err) {
          console.warn(
            "[GiftMessage] proxy error, falling back to cart update:",
            err,
          );
          // Graceful degradation: still update the cart attribute.
          updateCartAttributes(value, sender, recipient, onSuccess, onError);
        },
      );
    }

    function handleProductSubmit(event) {
      if (mode !== "product") return;

      var form = event && event.target ? event.target : findProductForm();
      if (!isProductForm(form)) return;

      prepareCardProductAdd(form);
    }

    function handleProductAddIntent(event) {
      if (mode !== "product") return;
      if (!isAddToCartTarget(event.target)) return;
      if (isDynamicCheckoutTarget(event.target)) return;

      var form = findProductFormForElement(event.target) || findProductForm();
      if (!isProductForm(form)) return;

      prepareCardProductAdd(form);
    }

    function prepareCardProductAdd(form) {
      syncProductProperties(form);
      persistProductMessage();

      var cardContext = buildCardProductAddContext(form);
      if (!cardContext) return;

      setPendingCardProductAdd(cardContext);
    }

    function handleProductCheckoutIntent(event) {
      if (mode !== "product") return;
      if (!isDynamicCheckoutTarget(event.target)) return;

      var now = Date.now();
      if (now - lastProductCheckoutIntentAt < 500) return;
      lastProductCheckoutIntentAt = now;

      var form = findProductFormForElement(event.target) || findProductForm();
      if (!isProductForm(form)) return;

      syncProductProperties(form);
      persistProductMessage();
    }

    function loadCardProductConfig(callback) {
      getCardProductConfig()
        .then(function (config) {
          cardProductConfig = config;
          cardVariantOptions = config && config.variants ? config.variants : [];
          selectedCardVariant =
            findFirstAvailableCardVariant(cardVariantOptions);
          if (cardProductPicker) {
            cardProductPicker.dataset.gmbCardProductsState =
              cardVariantOptions.length > 0 ? "ready" : "empty";
          }
          if (typeof callback === "function") callback(cardVariantOptions);
        })
        .catch(function (err) {
          console.warn("[GiftMessage] card product lookup failed:", err);
          cardProductConfig = null;
          cardVariantOptions = [];
          selectedCardVariant = null;
          if (cardProductPicker) {
            cardProductPicker.dataset.gmbCardProductsState = "error";
          }
          if (typeof callback === "function") callback(cardVariantOptions);
        });
    }

    function renderCardVariantPicker(variants) {
      if (!cardProductPicker) return;

      cardProductPicker.innerHTML = "";
      cardProductPicker.hidden = true;
      removeCardProductPickerStyleClasses(cardProductPicker);

      if (!Array.isArray(variants) || variants.length === 0) {
        return;
      }

      var label = document.createElement("div");
      label.className = "gmb-card-product-label";
      label.textContent = cardVariantLabel;

      var grid = document.createElement("div");
      grid.className = "gmb-card-product-grid";
      cardProductPicker.classList.add(
        "gmb-card-product-picker--" + cardVariantStyle,
      );

      if (cardVariantStyle === "dropdown") {
        renderCardVariantDropdown(cardProductPicker, label, variants);
        return;
      }

      variants.forEach(function (variant) {
        var available = isCardVariantAvailable(variant);
        var button = document.createElement("button");
        button.type = "button";
        button.className = "gmb-card-product-option";
        button.dataset.variantId = variant.variantId || "";
        button.setAttribute(
          "aria-pressed",
          selectedCardVariant &&
            button.dataset.variantId === selectedCardVariant.variantId
            ? "true"
            : "false",
        );
        button.disabled = !available;
        button.toggleAttribute("data-gmb-sold-out", !available);
        button.setAttribute("aria-disabled", available ? "false" : "true");

        var imageWrap = document.createElement("span");
        imageWrap.className = "gmb-card-product-image";

        if (variant.imageUrl) {
          var image = document.createElement("img");
          image.src = variant.imageUrl;
          image.alt = variant.imageAlt || "";
          image.loading = "lazy";
          imageWrap.appendChild(image);
        } else {
          var placeholder = document.createElement("span");
          placeholder.className = "gmb-card-product-placeholder";
          placeholder.setAttribute("aria-hidden", "true");
          placeholder.textContent = "+";
          imageWrap.appendChild(placeholder);
        }

        var title = document.createElement("span");
        title.className = "gmb-card-product-title";
        title.textContent = getCardVariantTitle(variant);

        button.appendChild(imageWrap);
        button.appendChild(title);

        if (variant.price) {
          var price = document.createElement("span");
          price.className = "gmb-card-product-price";
          price.textContent = formatCardVariantPrice(variant.price);
          button.appendChild(price);
        }

        if (!available) {
          var status = document.createElement("span");
          status.className = "gmb-card-product-status";
          status.textContent = "Out of stock";
          button.appendChild(status);
        }

        button.addEventListener("click", function () {
          if (!isCardVariantAvailable(variant)) return;
          setSelectedCardVariant(variant);
        });
        grid.appendChild(button);
      });

      cardProductPicker.appendChild(label);
      cardProductPicker.appendChild(grid);
      cardProductPicker.hidden = false;

      if (!toggle.checked) {
        setCardProductPickerDisabled(true);
      }
    }

    function renderCardVariantDropdown(container, label, variants) {
      var select = document.createElement("select");
      select.className = "gmb-card-product-select";
      select.disabled = !toggle.checked || !selectedCardVariant;
      select.setAttribute(
        "aria-disabled",
        selectedCardVariant ? "false" : "true",
      );

      variants.forEach(function (variant) {
        var available = isCardVariantAvailable(variant);
        var option = document.createElement("option");
        option.value = variant.variantId || "";
        option.disabled = !available;
        option.textContent = buildCardVariantOptionText(variant, available);

        if (
          selectedCardVariant &&
          selectedCardVariant.variantId === variant.variantId
        ) {
          option.selected = true;
        }

        select.appendChild(option);
      });

      select.addEventListener("change", function () {
        var selectedVariantId = select.value;
        var variant = variants.find(function (item) {
          return item.variantId === selectedVariantId;
        });
        setSelectedCardVariant(variant || null);
      });

      container.appendChild(label);
      container.appendChild(select);
      container.hidden = false;
    }

    function setSelectedCardVariant(variant) {
      if (variant && !isCardVariantAvailable(variant)) return;
      selectedCardVariant = variant || null;

      if (!cardProductPicker) {
        syncProductPropertiesFromCurrentForm();
        return;
      }

      cardProductPicker
        .querySelectorAll(".gmb-card-product-option")
        .forEach(function (button) {
          button.setAttribute(
            "aria-pressed",
            selectedCardVariant &&
              button.dataset.variantId === selectedCardVariant.variantId
              ? "true"
              : "false",
          );
        });

      var select = cardProductPicker.querySelector(".gmb-card-product-select");
      if (select && selectedCardVariant) {
        select.value = selectedCardVariant.variantId;
      }

      syncProductPropertiesFromCurrentForm();
      if (manualSave) {
        isDirty = true;
        hasSavedMessage = false;
        block.dataset.hasSavedMessage = "false";
        setSaving(hasAnyContent() ? "Unsaved" : "");
        updateManualUi();
      }
    }

    function setCardProductPickerDisabled(disabled) {
      if (!cardProductPicker) return;

      cardProductPicker
        .querySelectorAll(".gmb-card-product-option, .gmb-card-product-select")
        .forEach(function (control) {
          control.disabled =
            disabled || control.getAttribute("aria-disabled") === "true";
        });
    }

    function buildCardProductAddContext(form) {
      if (!lineItemPropertiesEnabled) return null;
      if (!cardVariantChoicesEnabled) return null;
      if (!selectedCardVariant || !selectedCardVariant.variantId) return null;
      if (!shouldIncludeMessageInProductForm()) return null;

      var value = getMessageValue();
      var sender = getSenderValue();
      var recipient = getRecipientValue();
      var hasTextContent = hasGiftMessageTextContent(sender, recipient, value);
      if (
        textFormEnabled &&
        !hasTextContent &&
        !shouldAttachMessageToCardProduct()
      ) {
        return null;
      }

      var messageId = ensureMessageId();
      var messageProperties = buildGiftMessageLineItemProperties(
        sender,
        recipient,
        value,
        messageId,
      );
      var cardProperties = copyObject(messageProperties);
      cardProperties[CARD_PRODUCT_SOURCE_PROPERTY] =
        buildOriginalProductReference(form);

      var originalItem = buildOriginalCartItem(
        form,
        buildGiftMessageReferenceProperties(messageId),
      );
      if (!originalItem) return null;

      return {
        cardItem: {
          id: selectedCardVariant.variantId,
          properties: cardProperties,
          quantity: 1,
        },
        consumed: false,
        form: form,
        originalItem: originalItem,
        onThemeError: function () {
          setSaving("Could not add message card. Try again.");
        },
        onThemeSuccess: function () {
          setSaving("Added to cart");
          window.setTimeout(function () {
            setSaving("");
          }, 1800);
        },
      };
    }

    function setPendingCardProductAdd(context) {
      if (!nativeFetch) return;
      consumePendingProductAdd(pendingProductAdd);
      pendingProductAdd = context;

      context.expiryTimer = window.setTimeout(function () {
        if (pendingProductAdd !== context || context.consumed) return;
        consumePendingProductAdd(context);
      }, 4000);
    }

    function syncProductPropertiesFromCurrentForm() {
      syncProductProperties();
    }

    function syncProductProperties(form) {
      if (mode !== "product") return false;

      form = form || findProductForm();
      if (!isProductForm(form)) return false;

      var value = getMessageValue();
      var sender = getSenderValue();
      var recipient = getRecipientValue();
      var hasTextContent = hasGiftMessageTextContent(sender, recipient, value);
      var hasProductAddOn = shouldAttachMessageToCardProduct();
      var shouldIncludePayload =
        shouldIncludeMessageInProductForm() &&
        (hasTextContent || hasProductAddOn);

      removeProductProperties(form);

      if (!lineItemPropertiesEnabled) return false;
      if (!shouldIncludePayload) return false;
      if (manualSave && (!hasSavedMessage || isDirty)) return false;

      var messageId = ensureMessageId();

      if (shouldAttachMessageToCardProduct()) {
        addProductProperties(
          form,
          buildGiftMessageReferenceProperties(messageId),
        );
      } else {
        addProductProperty(
          form,
          MESSAGE_PROPERTY,
          formatLineItemGiftMessage(sender, recipient, value),
        );
        addProductProperty(form, MESSAGE_REFERENCE_PROPERTY, messageId);
      }

      return true;
    }

    function persistProductMessage(onSuccess, onError) {
      var value = getMessageValue();
      var sender = getSenderValue();
      var recipient = getRecipientValue();
      var hasContent =
        textFormEnabled &&
        shouldIncludeMessageInProductForm() &&
        hasGiftMessageTextContent(sender, recipient, value);

      if (!hasContent) return;
      if (manualSave && (!hasSavedMessage || isDirty)) return;

      var messageId = ensureMessageId();
      var variant = getSelectedVariant(findProductForm());

      persistMessage(
        value,
        sender,
        recipient,
        {
          cartToken: cartToken,
          cartReference: ensureCartReference(),
          messageId: messageId,
          mode: "product",
          productId: productId,
          productTitle: productTitle,
          productVariantTitle: getVariantTitle(variant),
          productSku: variant && variant.sku ? String(variant.sku) : "",
          productHandle: productHandle,
          keepalive: true,
        },
        onSuccess,
        onError,
      );
    }

    function addSelectedCardProductToCart(onSuccess, onError) {
      if (!shouldAttachMessageToCardProduct()) {
        if (typeof onSuccess === "function") onSuccess();
        return;
      }

      if (!nativeFetch) {
        if (typeof onError === "function")
          onError(new Error("fetch unavailable"));
        return;
      }

      var messageId = ensureMessageId();
      var properties = buildGiftMessageLineItemProperties(
        getSenderValue(),
        getRecipientValue(),
        getMessageValue(),
        messageId,
      );
      var selection = getSelectedCardVariantReference();
      var variantId = selectedCardVariant.variantId;

      properties[CARD_PRODUCT_SOURCE_PROPERTY] =
        mode === "order" ? "Cart drawer" : buildOriginalProductReference();

      if (selection) {
        properties[CARD_PRODUCT_SELECTION_PROPERTY] = selection;
      }

      if (variantId) {
        properties[CARD_PRODUCT_VARIANT_ID_PROPERTY] = variantId;
      }

      addCardProductVariantToCart(variantId, properties, onSuccess, onError);
    }

    function isDynamicCheckoutTarget(target) {
      if (!target || typeof target.closest !== "function") return false;

      return Boolean(
        target.closest(
          [
            ".shopify-payment-button",
            "[data-shopify='payment-button']",
            "shopify-accelerated-checkout",
            "shopify-buy-it-now-button",
            "button[name='checkout']",
            "[name='checkout']",
            "a[href*='/checkout']",
          ].join(","),
        ),
      );
    }

    function isAddToCartTarget(target) {
      if (!target || typeof target.closest !== "function") return false;

      var trigger = target.closest(
        [
          "button[type='submit']",
          "input[type='submit']",
          "button[name='add']",
          "input[name='add']",
          "[data-add-to-cart]",
          "[data-add-to-cart-button]",
        ].join(","),
      );

      if (!trigger || isDynamicCheckoutTarget(trigger)) return false;

      return Boolean(findProductFormForElement(trigger));
    }

    function findProductFormForElement(target) {
      if (!target || typeof target.closest !== "function") return null;

      var directForm = target.closest("form");
      if (isProductForm(directForm)) return directForm;

      var section = target.closest("[id^='shopify-section-']");
      if (section) {
        var sectionForm = section.querySelector("form[action*='/cart/add']");
        if (isProductForm(sectionForm)) return sectionForm;
      }

      return null;
    }

    function findProductForm() {
      if (textarea.form && isProductForm(textarea.form)) return textarea.form;

      var closestForm = block.closest("form");
      if (isProductForm(closestForm)) return closestForm;

      var section = block.closest("[id^='shopify-section-']");
      if (section) {
        var sectionForm = section.querySelector("form[action*='/cart/add']");
        if (isProductForm(sectionForm)) return sectionForm;
      }

      var addForm = document.querySelector("form[action*='/cart/add']");
      if (isProductForm(addForm)) return addForm;

      var variantInput = document.querySelector("form input[name='id']");
      return variantInput ? variantInput.form : null;
    }

    function isProductForm(form) {
      return Boolean(
        form &&
        form.tagName === "FORM" &&
        (String(form.getAttribute("action") || "").indexOf("/cart/add") !==
          -1 ||
          form.querySelector("input[name='id'], select[name='id']")),
      );
    }

    function addProductProperty(form, name, value) {
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = "properties[" + name + "]";
      input.value = value;
      input.setAttribute("data-gmb-property", "");
      form.appendChild(input);
    }

    function addProductProperties(form, properties) {
      Object.keys(properties || {}).forEach(function (key) {
        addProductProperty(form, key, properties[key]);
      });
    }

    function removeProductProperties(form) {
      if (!form) return;
      form.querySelectorAll("[data-gmb-property]").forEach(function (input) {
        input.remove();
      });
    }

    function buildOriginalCartItem(form, messageProperties) {
      if (!form) return null;

      var formData = new FormData(form);
      var variantId = String(formData.get("id") || "").trim();
      if (!variantId) {
        var variantInput = form.querySelector(
          "input[name='id'], select[name='id']",
        );
        variantId = variantInput ? String(variantInput.value || "").trim() : "";
      }
      if (!variantId) return null;

      var properties = collectLineItemProperties(formData);
      Object.keys(messageProperties).forEach(function (key) {
        properties[key] = messageProperties[key];
      });

      var quantity = parseQuantity(formData.get("quantity"));
      var item = {
        id: variantId,
        properties: properties,
        quantity: quantity,
      };
      var sellingPlan = String(formData.get("selling_plan") || "").trim();

      if (sellingPlan) {
        item.selling_plan = sellingPlan;
      }

      return item;
    }

    function buildGiftMessageLineItemProperties(
      sender,
      recipient,
      message,
      messageId,
    ) {
      var properties = {};
      var cleanSender = String(sender || "").trim();
      var cleanRecipient = String(recipient || "").trim();
      var cleanMessage = String(message || "").trim();
      var formattedMessage = formatLineItemGiftMessage(
        cleanSender,
        cleanRecipient,
        cleanMessage,
      );

      if (formattedMessage) {
        properties[MESSAGE_PROPERTY] = cleanMessage || formattedMessage;
      }

      if (cleanSender) {
        properties[MESSAGE_FROM_PROPERTY] = cleanSender;
      }

      if (cleanRecipient) {
        properties[MESSAGE_TO_PROPERTY] = cleanRecipient;
      }

      properties[MESSAGE_REFERENCE_PROPERTY] = messageId;

      return properties;
    }

    function hasGiftMessageTextContent(sender, recipient, message) {
      if (!textFormEnabled) return false;

      return Boolean(
        String(message || "").trim() ||
        String(sender || "").trim() ||
        String(recipient || "").trim(),
      );
    }

    function buildGiftMessageReferenceProperties(messageId) {
      var properties = {};
      var cardSelection = getSelectedCardVariantReference();

      properties[MESSAGE_REFERENCE_PROPERTY] = messageId;

      if (cardSelection) {
        properties[CARD_PRODUCT_SELECTION_PROPERTY] = cardSelection;
      }

      if (selectedCardVariant && selectedCardVariant.variantId) {
        properties[CARD_PRODUCT_VARIANT_ID_PROPERTY] =
          selectedCardVariant.variantId;
      }

      return properties;
    }

    function collectLineItemProperties(formData) {
      var properties = {};

      formData.forEach(function (value, key) {
        var match = String(key).match(/^properties\[(.+)\]$/);
        if (!match) return;

        var propertyName = match[1];
        var propertyValue = String(value || "");
        if (propertyName) {
          properties[propertyName] = propertyValue;
        }
      });

      return properties;
    }

    function parseQuantity(value) {
      var quantity = parseInt(String(value || "1"), 10);
      return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    }

    function shouldIncludeMessageInProductForm() {
      if (!manualSave) return toggle.checked;
      return hasSavedMessage && !isDirty;
    }

    function shouldAttachMessageToCardProduct() {
      return Boolean(
        cardVariantChoicesEnabled &&
        selectedCardVariant &&
        selectedCardVariant.variantId,
      );
    }

    function persistMessage(
      value,
      sender,
      recipient,
      options,
      onSuccess,
      onError,
    ) {
      options = options || {};

      fetch(getAppProxyPath(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: Boolean(options.keepalive),
        body: JSON.stringify({
          message: value,
          sender: sender,
          recipient: recipient,
          cart_token: options.cartToken || "",
          cart_reference: options.cartReference || ensureCartReference(),
          message_id: options.messageId || "",
          mode: options.mode || mode,
          product_id: options.productId || "",
          product_title: options.productTitle || "",
          product_variant_title: options.productVariantTitle || "",
          product_sku: options.productSku || "",
          product_handle: options.productHandle || "",
        }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("proxy " + res.status);
          return res.json();
        })
        .then(function () {
          if (typeof onSuccess === "function") onSuccess();
        })
        .catch(function (err) {
          if (typeof onError === "function") {
            onError(err);
          } else {
            console.warn("[GiftMessage] proxy error:", err);
          }
        });
    }

    function updateCartAttributes(
      value,
      sender,
      recipient,
      onSuccess,
      onError,
    ) {
      var root = getShopifyRoot();
      fetch(root + "cart/update.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attributes: {
            "Gift Message":
              value || sender || recipient
                ? formatLineItemGiftMessage(sender, recipient, value)
                : "",
            "Gift Message From": "",
            "Gift Message To": "",
            "Gift Message Ref": "",
            gift_message: "",
            gift_message_from: "",
            gift_message_to: "",
            gift_order_reference: "",
          },
        }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("cart/update " + res.status);
          if (typeof onSuccess === "function") onSuccess();
        })
        .catch(function (err) {
          console.warn("[GiftMessage]", err);
          setSaving("");
          if (typeof onError === "function") onError(err);
        });
    }

    function loadCartToken(callback) {
      if (cartToken) {
        if (typeof callback === "function") callback(cartToken);
        return;
      }

      var root = getShopifyRoot();
      fetch(root + "cart.js", { headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) throw new Error("cart.js " + res.status);
          return res.json();
        })
        .then(function (cart) {
          cartToken = cart && cart.token ? cart.token : "";
          block.dataset.cartToken = cartToken;
          cartReference = formatStableReference("GO", cartToken);
          if (typeof callback === "function") callback(cartToken);
        })
        .catch(function (err) {
          console.warn("[GiftMessage] cart token lookup failed:", err);
          if (typeof callback === "function") callback("");
        });
    }

    function ensureMessageId() {
      if (!messageIdInput) return "";
      if (!messageIdInput.value) {
        messageIdInput.value = createReference("GM");
      }
      messageIdInput.disabled = false;
      return messageIdInput.value;
    }

    function ensureCartReference() {
      if (cartReference) return cartReference;

      if (cartToken) {
        cartReference = formatStableReference("GO", cartToken);
        return cartReference;
      }

      cartReference = createReference("GO");
      return cartReference;
    }

    function getMessageValue() {
      return textarea ? textarea.value : "";
    }

    function getSenderValue() {
      return senderInput ? senderInput.value : "";
    }

    function getRecipientValue() {
      return recipientInput ? recipientInput.value : "";
    }

    function getProductVariants() {
      var variantsNode = block.querySelector(".gmb-variants-json");
      if (!variantsNode) return [];

      try {
        return JSON.parse(variantsNode.textContent || "[]") || [];
      } catch (err) {
        console.warn("[GiftMessage] product variant data parse failed:", err);
        return [];
      }
    }

    function getSelectedVariant(form) {
      if (!form) return null;

      var variantInput = form.querySelector(
        "input[name='id'], select[name='id']",
      );
      var variantId = variantInput ? String(variantInput.value || "") : "";

      if (!variantId) return null;

      return (
        productVariants.find(function (variant) {
          return String(variant.id || "") === variantId;
        }) || null
      );
    }

    function getVariantTitle(variant) {
      var title = variant && variant.title ? String(variant.title).trim() : "";
      return title && title.toLowerCase() !== "default title" ? title : "";
    }

    function getCardVariantTitle(variant) {
      var title = variant && variant.title ? String(variant.title).trim() : "";

      if (title && title.toLowerCase() !== "default title") {
        return title;
      }

      return cardProductConfig && cardProductConfig.title
        ? cardProductConfig.title
        : "Message card";
    }

    function getSelectedCardVariantReference() {
      if (!selectedCardVariant || !selectedCardVariant.variantId) return "";

      var productName =
        cardProductConfig && cardProductConfig.title
          ? cardProductConfig.title
          : "Message card";
      var variantTitle = getCardVariantTitle(selectedCardVariant);

      if (variantTitle && variantTitle !== productName) {
        return productName + " - " + variantTitle;
      }

      return productName;
    }

    function buildOriginalProductReference(form) {
      var variant = getSelectedVariant(form);
      var title = String(productTitle || "").trim();
      var variantTitle = getVariantTitle(variant);
      var sku = variant && variant.sku ? String(variant.sku).trim() : "";
      var parts = [];

      if (title) {
        parts.push(title + (variantTitle ? " - " + variantTitle : ""));
      }

      if (sku) {
        parts.push("SKU: " + sku);
      }

      return parts.join(" | ") || productHandle || "Gift message product";
    }

    function findFirstAvailableCardVariant(variants) {
      if (!Array.isArray(variants)) return null;

      return (
        variants.find(function (variant) {
          return isCardVariantAvailable(variant);
        }) || null
      );
    }

    function isCardVariantAvailable(variant) {
      return !variant || variant.available !== false;
    }

    function formatCardVariantPrice(price) {
      var rawPrice = String(price || "").trim();
      if (!rawPrice) return "";

      var numericPrice = Number(rawPrice.replace(/[^0-9.-]/g, ""));
      if (!Number.isFinite(numericPrice) || !moneyCurrencyCode) {
        return rawPrice;
      }

      try {
        return new Intl.NumberFormat(getLocaleCode(), {
          currency: moneyCurrencyCode,
          style: "currency",
        }).format(numericPrice);
      } catch (err) {
        return rawPrice;
      }
    }

    function buildCardVariantOptionText(variant, available) {
      var parts = [getCardVariantTitle(variant)];
      var price = formatCardVariantPrice(variant && variant.price);

      if (price) parts.push(price);
      if (!available) parts.push("Out of stock");

      return parts.join(" - ");
    }

    function formatLineItemGiftMessage(sender, recipient, message) {
      var lines = [];
      var cleanSender = String(sender || "").trim();
      var cleanRecipient = String(recipient || "").trim();
      var cleanMessage = String(message || "").trim();

      if (cleanSender) lines.push("From: " + cleanSender);
      if (cleanRecipient) lines.push("To: " + cleanRecipient);
      if (cleanMessage) lines.push("Message: " + cleanMessage);

      return lines.join("\n");
    }

    function createReference(prefix) {
      var code = "";

      if (
        window.crypto &&
        typeof window.crypto.getRandomValues === "function"
      ) {
        var values = new Uint32Array(REFERENCE_LENGTH);
        window.crypto.getRandomValues(values);
        for (var i = 0; i < values.length; i += 1) {
          code += REFERENCE_ALPHABET[values[i] % REFERENCE_ALPHABET.length];
        }
      } else {
        for (var j = 0; j < REFERENCE_LENGTH; j += 1) {
          code +=
            REFERENCE_ALPHABET[
              Math.floor(Math.random() * REFERENCE_ALPHABET.length)
            ];
        }
      }

      return prefix + "-" + code;
    }

    function formatStableReference(prefix, value) {
      var hash = 0;
      var cleanValue = String(value || "");

      for (var i = 0; i < cleanValue.length; i += 1) {
        hash = (hash * 31 + cleanValue.charCodeAt(i)) >>> 0;
      }

      var code = "";
      for (var j = 0; j < REFERENCE_LENGTH; j += 1) {
        code = REFERENCE_ALPHABET[hash % REFERENCE_ALPHABET.length] + code;
        hash = Math.floor(hash / REFERENCE_ALPHABET.length);
      }

      return prefix + "-" + code;
    }
  }

  function getCardProductConfig() {
    if (cardProductsRequest) return cardProductsRequest;

    if (!nativeFetch) {
      return Promise.resolve(null);
    }

    cardProductsRequest = nativeFetch(getCardProductsProxyUrl(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(function (res) {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("card products " + res.status);
        return res.json();
      })
      .then(function (json) {
        var config = normalizeCardProductConfig(json && json.product);
        if (!config) {
          cardProductsRequest = null;
        }
        return config;
      })
      .catch(function (err) {
        cardProductsRequest = null;
        console.warn("[GiftMessage] card products unavailable:", err);
        return null;
      });

    return cardProductsRequest;
  }

  function getCardProductsProxyUrl() {
    var params = new URLSearchParams();
    var shop = getShopDomain();

    params.set("intent", CARD_PRODUCTS_INTENT);
    if (shop) params.set("shop", shop);

    return getAppProxyPath() + "?" + params.toString();
  }

  function getAppProxyPath() {
    var root = getShopifyRoot();

    return root.replace(/\/?$/, "/") + PROXY_PATH.replace(/^\//, "");
  }

  function getShopifyRoot() {
    return (
      (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) ||
      "/"
    );
  }

  function getShopDomain() {
    if (!window.Shopify || typeof window.Shopify !== "object") return "";

    return cleanString(
      window.Shopify.shop ||
        window.Shopify.shopDomain ||
        window.Shopify.shop_domain ||
        "",
    );
  }

  function normalizeCardProductConfig(product) {
    if (!product || typeof product !== "object") return null;

    var variants = Array.isArray(product.variants)
      ? product.variants
          .map(function (variant) {
            var variantId = cleanString(variant && variant.variantId);
            var title = cleanString(variant && variant.title);

            if (!variantId || !title) return null;

            return {
              available:
                variant && typeof variant.available === "boolean"
                  ? variant.available
                  : true,
              imageAlt: cleanString(variant && variant.imageAlt),
              imageUrl: cleanString(variant && variant.imageUrl),
              price: cleanString(variant && variant.price),
              sku: cleanString(variant && variant.sku),
              title: title,
              variantGid: cleanString(variant && variant.variantGid),
              variantId: variantId,
            };
          })
          .filter(Boolean)
      : [];

    if (variants.length === 0) return null;

    return {
      handle: cleanString(product.handle),
      imageAlt: cleanString(product.imageAlt),
      imageUrl: cleanString(product.imageUrl),
      productGid: cleanString(product.productGid),
      title: cleanString(product.title),
      variants: variants,
    };
  }

  function installCartAddInterceptor() {
    if (cartAddInterceptorInstalled || !nativeFetch) return;
    cartAddInterceptorInstalled = true;

    window.fetch = function (input, init) {
      var context = pendingProductAdd;

      if (!context || context.consumed || !isCartAddRequest(input, init)) {
        return nativeFetch(input, init);
      }

      var options = extractCartAddOptions(init && init.body);
      var request = buildCartAddRequest(input, init, context, options);
      consumePendingProductAdd(context);

      return nativeFetch(request.url, request.init).then(function (response) {
        if (response.ok) {
          if (typeof context.onThemeSuccess === "function") {
            context.onThemeSuccess(response);
          }
          notifyThemeCartListeners(response);
        } else if (typeof context.onThemeError === "function") {
          context.onThemeError(response);
        }

        return response;
      });
    };
  }

  function isCartAddRequest(input, init) {
    var method = cleanString((init && init.method) || input.method || "GET");
    var url = cleanString(input && input.url ? input.url : input);

    if (method.toUpperCase() !== "POST") return false;
    return /\/cart\/add(\.js)?(?:\?|$)/.test(url);
  }

  function buildCartAddRequest(input, init, context, options) {
    var url = cleanString(input && input.url ? input.url : input);
    var nextInit = copyObject(init || {});
    var payload = {
      items: [context.originalItem, context.cardItem],
    };

    if (options.sections) payload.sections = options.sections;
    if (options.sections_url) payload.sections_url = options.sections_url;

    nextInit.method = "POST";
    nextInit.body = JSON.stringify(payload);
    nextInit.headers = mergeHeaders(nextInit.headers, {
      Accept: "application/json",
      "Content-Type": "application/json",
    });

    return { init: nextInit, url: url };
  }

  function extractCartAddOptions(body) {
    var options = {};

    if (!body) return options;

    if (typeof FormData !== "undefined" && body instanceof FormData) {
      setOptionIfPresent(options, "sections", body.get("sections"));
      setOptionIfPresent(options, "sections_url", body.get("sections_url"));
      return options;
    }

    if (
      typeof URLSearchParams !== "undefined" &&
      body instanceof URLSearchParams
    ) {
      setOptionIfPresent(options, "sections", body.get("sections"));
      setOptionIfPresent(options, "sections_url", body.get("sections_url"));
      return options;
    }

    if (typeof body === "string") {
      try {
        var json = JSON.parse(body);
        setOptionIfPresent(options, "sections", json.sections);
        setOptionIfPresent(options, "sections_url", json.sections_url);
      } catch (err) {
        var params = new URLSearchParams(body);
        setOptionIfPresent(options, "sections", params.get("sections"));
        setOptionIfPresent(options, "sections_url", params.get("sections_url"));
      }
    }

    return options;
  }

  function setOptionIfPresent(options, key, value) {
    if (value === undefined || value === null || value === "") return;
    options[key] = value;
  }

  function consumePendingProductAdd(context) {
    if (!context) return;
    context.consumed = true;

    if (context.expiryTimer) {
      window.clearTimeout(context.expiryTimer);
    }

    if (pendingProductAdd === context) {
      pendingProductAdd = null;
    }
  }

  function notifyThemeCartListeners(response) {
    if (!response || typeof response.clone !== "function") return;

    response
      .clone()
      .json()
      .then(function (data) {
        document.dispatchEvent(
          new CustomEvent("gmb:cart-added", { detail: data }),
        );
      })
      .catch(function () {});
  }

  function addCardProductVariantToCart(
    variantId,
    properties,
    onSuccess,
    onError,
  ) {
    if (!nativeFetch || !variantId) {
      if (typeof onSuccess === "function") onSuccess();
      return;
    }

    cardProductVariantExistsInCart(variantId, properties)
      .then(function (exists) {
        if (exists) return null;

        var root = getShopifyRoot();
        return nativeFetch(root + "cart/add.js", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: [
              {
                id: variantId,
                properties: properties,
                quantity: 1,
              },
            ],
          }),
        }).then(function (response) {
          if (!response.ok) throw new Error("cart/add " + response.status);
          notifyThemeCartListeners(response);
          return response;
        });
      })
      .then(function () {
        scheduleDrawerEmbedsSync();
        if (typeof onSuccess === "function") onSuccess();
      })
      .catch(function (err) {
        console.warn("[GiftMessage] message card add failed:", err);
        if (typeof onError === "function") onError(err);
      });
  }

  function cardProductVariantExistsInCart(variantId, properties) {
    var reference = cleanString(
      properties && properties[MESSAGE_REFERENCE_PROPERTY],
    );
    if (!reference) return Promise.resolve(false);

    var root = getShopifyRoot();
    return nativeFetch(root + "cart.js", {
      headers: { Accept: "application/json" },
    })
      .then(function (response) {
        if (!response.ok) throw new Error("cart.js " + response.status);
        return response.json();
      })
      .then(function (cart) {
        var items = Array.isArray(cart && cart.items) ? cart.items : [];
        return items.some(function (item) {
          var itemVariantId = cleanString(item && item.variant_id);
          var itemProperties = item && item.properties ? item.properties : {};

          return (
            itemVariantId === cleanString(variantId) &&
            cleanString(itemProperties[MESSAGE_REFERENCE_PROPERTY]) ===
              reference
          );
        });
      })
      .catch(function () {
        return false;
      });
  }

  function mergeHeaders(headers, values) {
    var nextHeaders = new Headers(headers || {});

    Object.keys(values).forEach(function (key) {
      nextHeaders.set(key, values[key]);
    });

    return nextHeaders;
  }

  function copyObject(value) {
    var copy = {};

    Object.keys(value || {}).forEach(function (key) {
      copy[key] = value[key];
    });

    return copy;
  }

  function normalizeCardVariantStyle(value) {
    var style = cleanString(value);
    var allowedStyles = [
      "dropdown",
      "grid_4",
      "grid_3",
      "list_images",
      "text_list",
      "pills",
    ];

    return allowedStyles.indexOf(style) !== -1 ? style : "grid_4";
  }

  function removeCardProductPickerStyleClasses(element) {
    if (!element) return;

    [
      "dropdown",
      "grid_4",
      "grid_3",
      "list_images",
      "text_list",
      "pills",
    ].forEach(function (style) {
      element.classList.remove("gmb-card-product-picker--" + style);
    });
  }

  function getCurrencyCode(fallback) {
    return cleanString(
      (window.Shopify &&
        window.Shopify.currency &&
        window.Shopify.currency.active) ||
        fallback ||
        "",
    ).toUpperCase();
  }

  function getLocaleCode() {
    return (
      cleanString(document.documentElement && document.documentElement.lang) ||
      (navigator.languages && navigator.languages[0]) ||
      navigator.language ||
      "en"
    );
  }

  function cleanString(value) {
    return String(value || "").trim();
  }

  function initBlocksIn(root) {
    var scope = root || document;

    if (
      scope.nodeType === 1 &&
      typeof scope.matches === "function" &&
      scope.matches("[data-gmb-block]")
    ) {
      initBlock(scope);
    }

    if (typeof scope.querySelectorAll === "function") {
      scope.querySelectorAll("[data-gmb-block]").forEach(initBlock);
    }
  }

  function installGlobalToggleFallback() {
    if (globalToggleFallbackInstalled) return;
    globalToggleFallbackInstalled = true;

    document.addEventListener(
      "change",
      function (event) {
        var toggle = findGiftMessageToggle(event.target);
        if (toggle) syncPanelFromToggle(toggle);
      },
      true,
    );

    document.addEventListener(
      "click",
      function (event) {
        var toggle = findGiftMessageToggle(event.target);
        if (!toggle) return;

        window.setTimeout(function () {
          syncPanelFromToggle(toggle);
        }, 0);
      },
      true,
    );
  }

  function findGiftMessageToggle(target) {
    if (!target || typeof target.closest !== "function") return null;

    if (target.matches && target.matches(".gmb-check")) {
      return target;
    }

    var label = target.closest(".gmb-toggle");
    if (!label) return null;

    var targetId = label.getAttribute("for");
    var labelledToggle = targetId ? document.getElementById(targetId) : null;
    if (labelledToggle && labelledToggle.matches(".gmb-check")) {
      return labelledToggle;
    }

    var block = label.closest("[data-gmb-block]");
    return block ? block.querySelector(".gmb-check") : null;
  }

  function syncPanelFromToggle(toggle) {
    var block = toggle && toggle.closest("[data-gmb-block]");
    var field = block ? block.querySelector(".gmb-panel") : null;

    if (!block || !field) return;

    syncPanelOpenState(block, toggle, field, toggle.checked);
  }

  function syncPanelOpenState(block, toggle, field, open) {
    if (!block || !toggle || !field) return;

    field.hidden = !open;
    field.toggleAttribute("hidden", !open);
    field.toggleAttribute("data-gmb-open", open);
    field.style.display = open ? "" : "none";
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function initDrawerEmbedsIn(root) {
    var scope = root || document;

    if (
      scope.nodeType === 1 &&
      typeof scope.matches === "function" &&
      scope.matches("[data-gmb-drawer-embed]")
    ) {
      initDrawerEmbed(scope);
    }

    if (typeof scope.querySelectorAll === "function") {
      scope
        .querySelectorAll("[data-gmb-drawer-embed]")
        .forEach(initDrawerEmbed);
    }
  }

  function initDrawerEmbed(embed) {
    if (!embed.dataset.gmbDrawerEmbedId) {
      drawerEmbedCounter += 1;
      embed.dataset.gmbDrawerEmbedId =
        embed.id || "gmb-drawer-embed-" + drawerEmbedCounter;
    }

    if (embed.dataset.gmbDrawerInitialized === "true") {
      scheduleDrawerEmbedsSync();
      return;
    }

    embed.dataset.gmbDrawerInitialized = "true";
    syncDrawerEmbed(embed);
    window.setTimeout(function () {
      syncDrawerEmbed(embed);
    }, 300);
    window.setTimeout(function () {
      syncDrawerEmbed(embed);
    }, 1200);
  }

  function scheduleDrawerEmbedsSync() {
    if (drawerSyncTimer) return;

    drawerSyncTimer = window.setTimeout(function () {
      drawerSyncTimer = null;
      document
        .querySelectorAll("[data-gmb-drawer-embed]")
        .forEach(syncDrawerEmbed);
    }, 80);
  }

  function syncDrawerEmbed(embed) {
    if (!embed || embed.dataset.gmbDrawerEnabled === "false") return;

    var template = embed.querySelector("template[data-gmb-drawer-template]");
    if (!template || !template.content) return;

    var drawer = findCartDrawer(embed);
    if (!drawer) return;

    var embedId = embed.dataset.gmbDrawerEmbedId;
    removeDrawerMountsOutside(drawer, embedId);

    var mount = findDrawerMount(drawer, embedId);
    if (!mount) {
      mount = document.createElement("div");
      mount.className = "gmb-drawer-mount";
      mount.dataset.gmbDrawerMount = embedId;
    }

    applyDrawerMountSettings(embed, mount);
    insertDrawerMount(drawer, mount, embed.dataset.gmbDrawerPlacement);

    if (!mount.querySelector("[data-gmb-block]")) {
      mount.textContent = "";
      mount.appendChild(template.content.cloneNode(true));
    }

    initBlocksIn(mount);
  }

  function applyDrawerMountSettings(embed, mount) {
    if (!embed || !mount) return;

    mount.style.setProperty(
      "--gmb-drawer-padding-block",
      normalizePixelSetting(embed.dataset.gmbDrawerPaddingBlock, 0, 48) + "px",
    );
    mount.style.setProperty(
      "--gmb-drawer-padding-inline",
      normalizePixelSetting(embed.dataset.gmbDrawerPaddingInline, 0, 48) + "px",
    );
  }

  function findCartDrawer(embed) {
    var customSelector = cleanString(embed.dataset.gmbDrawerSelector);
    var candidates = [];

    if (customSelector) {
      try {
        pushDrawerCandidates(
          candidates,
          document.querySelectorAll(customSelector),
        );
      } catch (err) {
        console.warn("[GiftMessage] invalid drawer selector:", err);
      }
    }

    [
      "cart-drawer",
      "#CartDrawer",
      "#cart-drawer",
      ".cart-drawer",
      "[data-cart-drawer]",
      "[data-cart-drawer-root]",
      "[data-cart-drawer-container]",
      "[data-drawer='cart']",
      "[data-drawer-id='cart']",
      "[data-section-type='cart-drawer']",
      "[id*='CartDrawer']",
      "[id*='cart-drawer']",
      "[class*='cart-drawer']",
      "[class*='CartDrawer']",
    ].forEach(function (selector) {
      pushDrawerCandidates(candidates, document.querySelectorAll(selector));
    });

    return findBestDrawerCandidate(candidates, embed);
  }

  function pushDrawerCandidates(candidates, nodes) {
    Array.prototype.forEach.call(nodes || [], function (node) {
      if (candidates.indexOf(node) === -1) candidates.push(node);
    });
  }

  function findBestDrawerCandidate(candidates, embed) {
    var best = null;
    var bestScore = -Infinity;

    candidates.forEach(function (candidate) {
      var score = scoreDrawerCandidate(candidate, embed);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    });

    return bestScore >= 12 ? best : null;
  }

  function scoreDrawerCandidate(candidate, embed) {
    if (!candidate || candidate === document.body) return -Infinity;
    if (embed && (embed === candidate || embed.contains(candidate))) {
      return -Infinity;
    }

    var tagName = cleanString(candidate.tagName).toLowerCase();
    if (
      ["script", "style", "template", "link", "meta"].indexOf(tagName) !== -1
    ) {
      return -Infinity;
    }

    var descriptor = getElementDescriptor(candidate);
    var hasDrawerContent = hasCartDrawerContent(candidate);
    var isDrawerShell = isLikelyDrawerShell(candidate, tagName, descriptor);
    var score = 0;

    if (isDrawerTrigger(candidate, descriptor, hasDrawerContent)) {
      return -Infinity;
    }

    if (!hasDrawerContent && !isDrawerShell) {
      return -Infinity;
    }

    if (tagName === "cart-drawer") score += 18;
    if (/cart[-_\s]?drawer/i.test(descriptor)) score += 14;
    if (/drawer/i.test(descriptor) && /cart/i.test(descriptor)) score += 8;
    if (isDrawerShell) score += 10;
    if (hasDrawerContent) score += 18;
    if (candidate.hasAttribute("open")) score += 8;
    if (candidate.hidden) score -= 8;

    var ariaHidden = candidate.getAttribute("aria-hidden");
    if (ariaHidden === "false") score += 6;
    if (ariaHidden === "true") score -= 6;

    if (
      /\b(open|active|is-active|is-visible|menu-opening)\b/i.test(descriptor)
    ) {
      score += 6;
    }

    if (isElementVisible(candidate)) score += 5;

    return score;
  }

  function isDrawerTrigger(candidate, descriptor, hasDrawerContent) {
    var tagName = cleanString(candidate.tagName).toLowerCase();

    if (["a", "button", "input", "label", "summary"].indexOf(tagName) !== -1) {
      return true;
    }

    if (
      !hasDrawerContent &&
      candidate.closest &&
      candidate.closest("a, button, label, summary")
    ) {
      return true;
    }

    if (
      !hasDrawerContent &&
      /\b(icon|toggle|button|link|opener|trigger|bubble)\b/i.test(descriptor)
    ) {
      return true;
    }

    var role = cleanString(candidate.getAttribute("role")).toLowerCase();
    return !hasDrawerContent && (role === "button" || role === "link");
  }

  function isLikelyDrawerShell(candidate, tagName, descriptor) {
    return Boolean(
      tagName === "cart-drawer" ||
      candidate.getAttribute("role") === "dialog" ||
      candidate.getAttribute("aria-modal") === "true" ||
      /(^|\s)(cart-drawer|drawer|drawer__inner|cart-drawer__inner)(\s|$)/i.test(
        descriptor,
      ) ||
      /cart[-_\s]?drawer/i.test(descriptor),
    );
  }

  function hasCartDrawerContent(candidate) {
    return Boolean(
      candidate.querySelector &&
      candidate.querySelector(
        [
          "form[action*='/cart']",
          "button[name='checkout']",
          "input[name='checkout']",
          "a[href*='/checkout']",
          "cart-drawer-items",
          "[data-cart-items]",
          "[data-cart-drawer-items]",
          ".cart-drawer__items",
          ".cart-drawer__footer",
          ".cart-drawer__form",
          ".drawer__contents",
          ".drawer__footer",
          ".drawer__inner",
          ".cart-items",
          ".cart__items",
        ].join(","),
      ),
    );
  }

  function getElementDescriptor(element) {
    return cleanString(
      [
        element.id,
        typeof element.className === "string"
          ? element.className
          : element.getAttribute("class"),
      ].join(" "),
    );
  }

  function isElementVisible(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") {
      return false;
    }

    var style = window.getComputedStyle
      ? window.getComputedStyle(element)
      : null;
    if (
      style &&
      (style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse")
    ) {
      return false;
    }

    var rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function findDrawerMount(drawer, embedId) {
    var mount = null;

    drawer.querySelectorAll("[data-gmb-drawer-mount]").forEach(function (node) {
      if (!mount && node.dataset.gmbDrawerMount === embedId) {
        mount = node;
      }
    });

    return mount;
  }

  function removeDrawerMountsOutside(drawer, embedId) {
    document
      .querySelectorAll("[data-gmb-drawer-mount]")
      .forEach(function (node) {
        if (node.dataset.gmbDrawerMount === embedId && !drawer.contains(node)) {
          node.remove();
        }
      });
  }

  function insertDrawerMount(drawer, mount, placement) {
    var normalizedPlacement = normalizeDrawerPlacement(placement);
    var container = findDrawerContentContainer(drawer) || drawer;
    mount.dataset.gmbDrawerPlacementPosition = normalizedPlacement;

    if (normalizedPlacement === "below_cart_items") {
      var cartItems = findCartItemsTarget(container, drawer);
      if (placeMountAfter(mount, cartItems)) return;

      var fallbackSubtotal = findSubtotalTarget(container, drawer);
      if (placeMountBefore(mount, fallbackSubtotal)) return;

      var fallbackCheckout = findCheckoutTarget(container, drawer);
      if (placeMountBefore(mount, fallbackCheckout)) return;

      appendMountIfNeeded(container, mount);
      return;
    }

    if (normalizedPlacement === "above_subtotal") {
      var subtotal = findSubtotalTarget(container, drawer);
      if (placeMountBefore(mount, subtotal)) return;

      var checkoutFallback = findCheckoutTarget(container, drawer);
      if (placeMountBefore(mount, checkoutFallback)) return;

      appendMountIfNeeded(container, mount);
      return;
    }

    var checkoutTarget = findCheckoutTarget(container, drawer);
    if (placeMountBefore(mount, checkoutTarget)) return;

    appendMountIfNeeded(container, mount);
  }

  function normalizeDrawerPlacement(value) {
    var placement = cleanString(value);

    if (
      placement === "below_cart_items" ||
      placement === "above_subtotal" ||
      placement === "above_checkout"
    ) {
      return placement;
    }

    if (placement === "top") return "below_cart_items";
    if (placement === "bottom" || placement === "before_checkout") {
      return "above_checkout";
    }

    return "below_cart_items";
  }

  function findCartItemsTarget(container, drawer) {
    return findFirstPlacementTarget(
      container,
      drawer,
      [
        "cart-drawer-items",
        "[data-cart-items]",
        "[data-cart-drawer-items]",
        ".cart-drawer__items",
        ".drawer__cart-items-wrapper",
        ".cart-items",
        ".cart__items",
        "table.cart-items",
      ],
      "cartItems",
    );
  }

  function findSubtotalTarget(container, drawer) {
    return findFirstPlacementTarget(
      container,
      drawer,
      [
        "[data-cart-subtotal]",
        "[data-subtotal]",
        "[data-subtotal-price]",
        ".cart-drawer__subtotal",
        ".cart__subtotal",
        ".cart-subtotal",
        ".totals",
        ".cart-drawer__totals",
        ".cart_ctas [class*='subtotal']",
        ".cart_ctas [class*='Subtotal']",
        "[class*='subtotal']",
        "[class*='Subtotal']",
      ],
      "subtotal",
    );
  }

  function findCheckoutTarget(container, drawer) {
    return findFirstPlacementTarget(
      container,
      drawer,
      [
        "button[name='checkout']",
        "input[name='checkout']",
        "a[href*='/checkout']",
        "[data-cart-checkout-button]",
        ".cart__checkout-button",
        ".cart-drawer__checkout",
        ".shopify-payment-button",
      ],
      "checkout",
    );
  }

  function findFirstPlacementTarget(container, drawer, selectors, type) {
    for (var i = 0; i < selectors.length; i += 1) {
      var target =
        findPlacementTargetIn(container, selectors[i], type) ||
        (drawer !== container
          ? findPlacementTargetIn(drawer, selectors[i], type)
          : null);

      if (target) return target;
    }

    return null;
  }

  function findPlacementTargetIn(root, selector, type) {
    if (!root || typeof root.querySelectorAll !== "function") return null;

    var nodes = root.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (isInvalidPlacementTarget(node, type)) continue;
      return getPlacementAnchor(node, type);
    }

    return null;
  }

  function getPlacementAnchor(node, type) {
    if (type === "cartItems") {
      return getCartItemsPlacementAnchor(node);
    }

    if (type === "subtotal") {
      var subtotalAnchor =
        findClosestMatchingSelector(node, [
          ".cart-totals__container",
          "[class*='cart-totals__container']",
          ".cart-drawer__totals",
          ".cart__totals",
          ".totals",
          ".cart-subtotal",
          ".cart__subtotal",
          ".cart-drawer__subtotal",
        ]) || node;

      return getSafeBlockPlacementAnchor(subtotalAnchor, type);
    }

    return getSafeBlockPlacementAnchor(node, type);
  }

  function getCartItemsPlacementAnchor(node) {
    if (!node) return null;

    var customItems = findClosestMatchingSelector(node, [
      "cart-drawer-items",
      "[data-cart-drawer-items]",
      "[data-cart-items]",
    ]);
    if (customItems) return normalizeTablePlacementAnchor(customItems);

    var itemsAnchor =
      findClosestMatchingSelector(node, [
        ".drawer__cart-items-wrapper",
        ".cart-drawer__items",
        ".cart-items",
        ".cart__items",
      ]) || node;

    return normalizeTablePlacementAnchor(itemsAnchor);
  }

  function getSafeBlockPlacementAnchor(node, type) {
    var anchor = normalizeTablePlacementAnchor(node);

    while (anchor && anchor.parentElement) {
      if (isGiftMessageOwnedNode(anchor)) return null;
      if (!shouldPromotePlacementAnchor(anchor, type)) break;
      anchor = normalizeTablePlacementAnchor(anchor.parentElement);
    }

    return anchor;
  }

  function shouldPromotePlacementAnchor(anchor, type) {
    if (!anchor || !anchor.parentElement) return false;

    if (type === "subtotal" && isStableSubtotalAnchor(anchor)) return false;
    if (type === "cartItems" && isStableCartItemsAnchor(anchor)) return false;

    var tagName = cleanString(anchor.tagName).toLowerCase();
    if (
      ["span", "strong", "small", "b", "i", "em", "dt", "dd"].indexOf(
        tagName,
      ) !== -1
    ) {
      return true;
    }

    if (!window.getComputedStyle) return false;

    var style = window.getComputedStyle(anchor);
    var parentStyle = window.getComputedStyle(anchor.parentElement);
    var display = cleanString(style && style.display);
    var parentDisplay = cleanString(parentStyle && parentStyle.display);

    if (/^inline/.test(display) || display === "contents") return true;

    return Boolean(
      type === "subtotal" &&
      /flex|grid/.test(parentDisplay) &&
      anchor.parentElement.children.length <= 4,
    );
  }

  function isStableSubtotalAnchor(anchor) {
    return Boolean(
      anchor &&
      anchor.matches &&
      anchor.matches(
        [
          ".cart-totals__container",
          "[class*='cart-totals__container']",
          ".cart-drawer__totals",
          ".cart__totals",
          ".totals",
          ".cart-subtotal",
          ".cart__subtotal",
          ".cart-drawer__subtotal",
        ].join(","),
      ),
    );
  }

  function isStableCartItemsAnchor(anchor) {
    return Boolean(
      anchor &&
      anchor.matches &&
      anchor.matches(
        [
          "cart-drawer-items",
          "[data-cart-drawer-items]",
          "[data-cart-items]",
          ".drawer__cart-items-wrapper",
          ".cart-drawer__items",
          ".cart-items",
          ".cart__items",
          "table",
        ].join(","),
      ),
    );
  }

  function normalizeTablePlacementAnchor(node) {
    if (!node || node.nodeType !== 1) return null;

    var tagName = cleanString(node.tagName).toLowerCase();
    if (["tbody", "thead", "tfoot", "tr", "td", "th"].indexOf(tagName) !== -1) {
      return node.closest("table") || node;
    }

    return node;
  }

  function findClosestMatchingSelector(node, selectors) {
    if (!node || typeof node.closest !== "function") return null;

    for (var i = 0; i < selectors.length; i += 1) {
      var match = node.closest(selectors[i]);
      if (match) return match;
    }

    return null;
  }

  function isInvalidPlacementTarget(node, type) {
    if (!node) return true;
    if (node.matches("[data-gmb-drawer-mount], [data-gmb-block]")) return true;
    if (node.closest("[data-gmb-drawer-mount]")) return true;
    if (type !== "checkout" && node.closest(".gmb-box")) return true;

    if (type === "subtotal") {
      var text = cleanString(node.textContent).toLowerCase();
      if (text && /checkout|paypal|shop pay|apple pay|google pay/.test(text)) {
        return true;
      }
    }

    return false;
  }

  function placeMountBefore(mount, target) {
    if (!canPlaceMountNearTarget(mount, target)) return false;

    if (
      mount.parentNode === target.parentNode &&
      getNextElementSibling(mount) === target
    ) {
      return true;
    }

    target.parentNode.insertBefore(mount, target);
    return true;
  }

  function placeMountAfter(mount, target) {
    if (!canPlaceMountNearTarget(mount, target)) return false;

    if (
      mount.parentNode === target.parentNode &&
      getPreviousElementSibling(mount) === target
    ) {
      return true;
    }

    target.parentNode.insertBefore(mount, target.nextSibling);
    return true;
  }

  function canPlaceMountNearTarget(mount, target) {
    return Boolean(
      mount &&
      target &&
      target.parentNode &&
      target !== mount &&
      !mount.contains(target),
    );
  }

  function appendMountIfNeeded(container, mount) {
    if (!container || !mount) return;
    if (
      mount.parentNode === container &&
      container.lastElementChild === mount
    ) {
      return;
    }

    container.appendChild(mount);
  }

  function getNextElementSibling(element) {
    var node = element ? element.nextSibling : null;
    while (node && node.nodeType !== 1) node = node.nextSibling;
    return node || null;
  }

  function getPreviousElementSibling(element) {
    var node = element ? element.previousSibling : null;
    while (node && node.nodeType !== 1) node = node.previousSibling;
    return node || null;
  }

  function findDrawerContentContainer(drawer) {
    var selectors = [
      ".drawer__inner",
      ".cart-drawer__inner",
      "[class*='drawer__inner']",
      ".drawer__contents",
      ".cart-drawer__contents",
      "[class*='drawer__contents']",
      ".cart-drawer__form",
      "form[action*='/cart']",
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      var candidate = drawer.querySelector(selectors[i]);
      if (candidate && !candidate.matches("[data-gmb-drawer-mount]")) {
        return candidate;
      }
    }

    return drawer;
  }

  function normalizePixelSetting(value, min, max) {
    var number = parseInt(cleanString(value), 10);

    if (!Number.isFinite(number)) return min;
    if (number < min) return min;
    if (number > max) return max;

    return number;
  }

  function bootstrapGiftMessageBridge() {
    installGlobalToggleFallback();
    initBlocksIn(document);
    initDrawerEmbedsIn(document);

    document.addEventListener("shopify:section:load", function (event) {
      initBlocksIn(event.target);
      initDrawerEmbedsIn(event.target);
      scheduleDrawerEmbedsSync();
    });

    if (
      !mutationObserverInstalled &&
      document.body &&
      typeof MutationObserver !== "undefined"
    ) {
      mutationObserverInstalled = true;
      new MutationObserver(function (mutations) {
        var shouldSyncDrawers = false;

        mutations.forEach(function (mutation) {
          if (shouldIgnoreDrawerMutation(mutation)) return;

          if (mutation.type === "attributes") {
            shouldSyncDrawers = true;
            return;
          }

          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType !== 1) return;
            initBlocksIn(node);
            initDrawerEmbedsIn(node);
            shouldSyncDrawers = true;
          });
        });

        if (shouldSyncDrawers) scheduleDrawerEmbedsSync();
      }).observe(document.body, {
        attributeFilter: ["aria-hidden", "class", "hidden", "open"],
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
  }

  function shouldIgnoreDrawerMutation(mutation) {
    if (!mutation) return false;

    if (isGiftMessageOwnedNode(mutation.target)) return true;

    if (mutation.type !== "childList") return false;

    var addedNodes = Array.prototype.slice.call(mutation.addedNodes || []);
    var removedNodes = Array.prototype.slice.call(mutation.removedNodes || []);
    var changedNodes = addedNodes.concat(removedNodes).filter(function (node) {
      return node.nodeType === 1;
    });

    if (changedNodes.length === 0) return false;

    return changedNodes.every(isGiftMessageOwnedNode);
  }

  function isGiftMessageOwnedNode(node) {
    return Boolean(
      node &&
      node.nodeType === 1 &&
      (node.matches(
        "[data-gmb-drawer-mount], [data-gmb-block], [data-gmb-drawer-embed]",
      ) ||
        node.closest("[data-gmb-drawer-mount]")),
    );
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapGiftMessageBridge, {
      once: true,
    });
  } else {
    bootstrapGiftMessageBridge();
  }
})();
