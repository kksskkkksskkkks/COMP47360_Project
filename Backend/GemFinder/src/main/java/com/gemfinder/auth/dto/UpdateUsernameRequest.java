package com.gemfinder.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateUsernameRequest {

    @NotBlank
    @Size(min = 3, max = 64)
    private String username;
}
